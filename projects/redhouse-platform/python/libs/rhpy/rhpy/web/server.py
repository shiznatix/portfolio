import asyncio
import contextvars
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import dataclass
import functools
from functools import wraps
import inspect
from pathlib import Path
import threading
from typing import Any, Awaitable, Callable, Literal, TypeVar, cast, overload

from pydantic import ValidationError
from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse, PlainTextResponse, Response
from starlette.routing import Route

from .. import logger
from .. import model

T = TypeVar('T')

log = logger.get('http')

# dedicated executor for ctx.thread()
ctx_executor = ThreadPoolExecutor(thread_name_prefix='http-ctx')
def _executor_slots() -> str:
	active = len(ctx_executor._threads)  # pylint: disable=protected-access
	max_w = ctx_executor._max_workers  # pylint: disable=protected-access
	return f'executor slots: {active}/{max_w} active'


class RequestInputError(Exception):
	pass


class HTTPContext:
	def __init__(self, request: Request):
		self.request = request
		self.log = logger.get(f'req.{request.method}{request.url.path})')

		self._status_code: int = 200
		self._headers: dict[str, str] = {}
		self._media_type: str | None = None
		self._cancel_event: threading.Event = threading.Event()
		self._active_futures: list[Future[Any]] = []

	@property
	def status(self) -> int:
		return self._status_code

	@status.setter
	def status(self, value: int):
		self._status_code = value

	def header(self, name: str, value: str):
		self._headers[name] = value

	@property
	def headers(self) -> dict[str, str]:
		return self._headers

	@property
	def media_type(self) -> str | None:
		return self._media_type

	@property
	def cancel_event(self) -> threading.Event:
		return self._cancel_event

	@property
	def active_threads(self) -> list[Future[Any]]:
		return [f for f in self._active_futures if not f.done()]

	@overload
	async def thread(self, func: Callable[..., Awaitable[T]], *args: Any, **kwargs: Any) -> T: ...
	@overload
	async def thread(self, func: Callable[..., T], *args: Any, **kwargs: Any) -> T: ...
	async def thread(self, func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
		sig = inspect.signature(func)
		params = sig.parameters
		has_cancel_kwarg = 'cancel_event' in params
		has_var_kwargs = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values())
		if has_cancel_kwarg or has_var_kwargs:
			kwargs['cancel_event'] = self._cancel_event

		try:
			if inspect.iscoroutinefunction(func):
				return await func(*args, **kwargs)

			# Propagate context vars and run in the dedicated executor
			ctx = contextvars.copy_context()
			func_call = functools.partial(ctx.run, func, *args, **kwargs)
			loop = asyncio.get_running_loop()
			self.log.debug(f'Dispatching thread {func.__name__!r} — {_executor_slots()}')
			future = ctx_executor.submit(func_call)
			self._active_futures.append(future)
			try:
				return await asyncio.wrap_future(future, loop=loop)
			finally:
				self._active_futures.remove(future)
		except asyncio.CancelledError:
			self._cancel_event.set()
			raise

	def audio(
		self,
		file_path: str | Path,
		ext: Literal['wav', 'ogg'],
		*,
		file_name: str | None = None,
	) -> bytes:
		file_path = Path(file_path)
		file_bytes = file_path.read_bytes()
		self._media_type = f'audio/{ext}'
		self._headers['Content-Length'] = str(len(file_bytes))
		if file_name:
			file_name = file_name if file_name.endswith(ext) else f'{file_name}.{ext}'
			self._headers['Content-Disposition'] = f'inline; filename="{file_name}"'
		return file_bytes


@dataclass(frozen=True)
class _DeferredRoute:
	path: str
	method: Literal['GET', 'POST', 'PUT', 'DELETE']
	endpoint: Callable[..., Any]


@dataclass(frozen=True)
class _PublicConfig:
	root: str


def _build_endpoint(
	func: Callable,
	sig: inspect.Signature,
	accepts_ctx: bool,
	has_var_kwargs: bool,
	body: model.AnyModel | None,
	query: model.AnyModel | None,
) -> Callable[[Request], Any]:
	async def endpoint(request: Request) -> Response:
		ctx = HTTPContext(request)
		path_params = request.path_params
		kwargs: dict[str, Any] = {}
		if accepts_ctx:
			kwargs['ctx'] = ctx

		if has_var_kwargs:
			kwargs.update(path_params)
		else:
			for name, value in path_params.items():
				if name in sig.parameters:
					kwargs[name] = value

		if query is not None:
			query_data = None
			try:
				query_data = dict(request.query_params)
				validated_query = query.model_validate(query_data)
				kwargs['query'] = validated_query
			except ValidationError as e:
				ctx.status = 400
				errors = [
					f"{'.'.join(str(x) for x in err['loc'])} - {err['msg']}" for err in e.errors()
				]
				ctx.log.warning('Validation error', extra={'errors': errors, 'query': query_data})
				return _to_response({'error': errors}, ctx)
			except asyncio.CancelledError as e:
				raise e
			except Exception as e:
				ctx.status = 500
				ctx.log.exception(e)
				return _to_response({'error': str(e)}, ctx)

		if body is not None:
			body_data = None
			try:
				body_data = await _parse_body_data(request)
				if not body_data:
					ctx.status = 400
					return _to_response({'error': 'Request body is required'}, ctx)

				validated_body = body.model_validate(body_data)
				kwargs['body'] = validated_body
			except ValidationError as e:
				ctx.status = 400
				errors = [
					f"{'.'.join(str(x) for x in err['loc'])} - {err['msg']}" for err in e.errors()
				]
				ctx.log.warning('Validation error', extra={'errors': errors, 'body': body_data})
				return _to_response({'error': errors}, ctx)
			except RequestInputError as e:
				ctx.status = 400
				ctx.log.warning('Request input error', extra={'error': str(e)})
				return _to_response({'error': str(e)}, ctx)
			except asyncio.CancelledError as e:
				raise e
			except Exception as e:
				ctx.status = 500
				ctx.log.exception(e)
				return _to_response({'error': str(e)}, ctx)

		try:
			result = await func(**kwargs)
			return _to_response(result, ctx)
		except asyncio.CancelledError as e:
			ctx.cancel_event.set()
			raise e
		except Exception as e:
			ctx.cancel_event.set()
			ctx.status = 500
			ctx.log.exception(e)
			return _to_response({'error': str(e)}, ctx)
		finally:
			active_threads = ctx.active_threads
			if active_threads:
				ctx.log.warning(f'Request finished with {len(active_threads)} dangling thread(s) still running')
	return endpoint


def _with_semaphore(
	endpoint: Callable[[Request], Any],
	semaphore: asyncio.Semaphore,
	method: str,
	path: str,
) -> Callable[[Request], Any]:
	async def limited(request: Request) -> Response:
		if semaphore.locked():
			log.warning(f'Simultaneous limit reached for {method} {path}')
			return JSONResponse({'error': 'Too many concurrent requests'}, status_code=429)
		async with semaphore:
			return await endpoint(request)
	return limited


class RouteDecorators:
	def __init__(self, app: Starlette | None = None, *, public_root: str | None = None):
		self._app = app
		self._deferred_routes: list[_DeferredRoute] = []
		self._public: _PublicConfig | None = _PublicConfig(root=public_root) if public_root is not None else None

	def route(
		self,
		path: str,
		method: Literal['GET', 'POST', 'PUT', 'DELETE'] = 'GET',
		body: model.AnyModel | None = None,
		query: model.AnyModel | None = None,
		simultaneous: int | None = None,
	):
		def decorator(func: Callable) -> Callable:
			if not inspect.iscoroutinefunction(func):
				raise TypeError(f'Route handler {func.__name__!r} must be an async function')
			sig = inspect.signature(func)
			accepts_ctx = 'ctx' in sig.parameters
			has_var_kwargs = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values())

			handler: Callable[[Request], Any] = _build_endpoint(func, sig, accepts_ctx, has_var_kwargs, body, query)
			if simultaneous is not None:
				handler = _with_semaphore(handler, asyncio.Semaphore(simultaneous), method, path)

			registered_endpoint = wraps(func)(handler)
			deferred = _DeferredRoute(path=path, method=method, endpoint=registered_endpoint)

			if self._app is not None:
				_register_route(self._app, deferred)
				log.info(f'Registered route: {method} {path}')
			else:
				self._deferred_routes.append(deferred)

			return registered_endpoint

		return decorator

	def public(self, func: Callable | None = None, *, root: str = './public') -> Callable | None:
		self._public = _PublicConfig(root=root)
		return func

	def get(self, path: str, body: model.AnyModel | None = None, query: model.AnyModel | None = None, simultaneous: int | None = None) -> Callable:
		return self.route(path, method='GET', body=body, query=query, simultaneous=simultaneous)

	def post(self, path: str, body: model.AnyModel | None = None, query: model.AnyModel | None = None, simultaneous: int | None = None) -> Callable:
		return self.route(path, method='POST', body=body, query=query, simultaneous=simultaneous)

	def put(self, path: str, body: model.AnyModel | None = None, query: model.AnyModel | None = None, simultaneous: int | None = None) -> Callable:
		return self.route(path, method='PUT', body=body, query=query, simultaneous=simultaneous)

	def delete(self, path: str, body: model.AnyModel | None = None, query: model.AnyModel | None = None, simultaneous: int | None = None) -> Callable:
		return self.route(path, method='DELETE', body=body, query=query, simultaneous=simultaneous)

	def apply_to(self, app: Starlette) -> None:
		for deferred in self._deferred_routes:
			_register_route(app, deferred)
			log.info(f'Registered route: {deferred.method} {deferred.path}')

		if self._public is not None:
			_register_public(app, self._public)

		self._deferred_routes.clear()


def health_handler(_request: Request) -> Response:
	return PlainTextResponse('ok')


async def _not_found_handler(_request: Request, _exc: Exception) -> Response:
	return JSONResponse({'error': 'Route not found'}, status_code=404)


def create_asgi_app(
	routes: RouteDecorators | None = None,
	*,
	cors: bool = True,
	lifespan: Any = None,
) -> Starlette:
	app = Starlette(
		routes=[Route('/health', endpoint=health_handler, methods=['GET'])],
		lifespan=lifespan,
		exception_handlers={404: _not_found_handler},
	)

	if cors:
		app.add_middleware(
			CORSMiddleware,
			allow_origins=['*'],
			allow_methods=['*'],
			allow_headers=['*'],
			expose_headers=['*'],
		)

	if routes:
		routes.apply_to(app)

	return app


def _register_route(app: Starlette, route: _DeferredRoute) -> None:
	app.router.routes.append(Route(route.path, endpoint=route.endpoint, methods=[route.method]))


def _register_public(app: Starlette, public: _PublicConfig) -> None:
	root = Path(public.root)

	async def public_endpoint(request: Request):
		req_path = request.path_params.get('filename', '').lstrip('/')

		# Serve index.html only for root or explicit reference
		if req_path == '' or req_path.endswith('/'):
			req_path = 'index.html'

		candidate = (root / req_path).resolve()
		try:
			candidate.relative_to(root.resolve())
		except Exception:
			return Response(status_code=404)

		if candidate.is_file():
			return FileResponse(candidate)

		return Response(status_code=404)

	# Must be last so it doesn't shadow explicit API routes
	app.router.routes.append(Route('/{filename:path}', endpoint=public_endpoint, methods=['GET']))


async def _parse_body_data(request: Request) -> dict[str, Any] | list[Any]:
	content_type = request.headers.get('content-type', '')

	if 'application/json' in content_type:
		payload = await request.json()
		if payload is None:
			return {}
		if not isinstance(payload, (dict, list)):
			raise RequestInputError('JSON body must be an object or array')
		return cast(dict[str, Any] | list[Any], payload)

	# form/multipart
	form = await request.form()
	body: dict[str, Any] = {}
	for key, value in form.multi_items():
		# UploadFile
		if hasattr(value, 'read'):
			file_bytes = await value.read()  # type: ignore[attr-defined]
			if file_bytes:
				body[key] = file_bytes
		else:
			body[key] = value

	return body


def _to_response(result: Any, ctx: HTTPContext) -> Response:
	if isinstance(result, Response):
		return result

	status_code = ctx.status
	headers = ctx.headers

	if isinstance(result, (dict, list)):
		return JSONResponse(result, status_code=status_code, headers=headers)
	if isinstance(result, model.Model):
		return JSONResponse(result.model_dump(), status_code=status_code, headers=headers)
	if isinstance(result, bytes):
		return Response(result, status_code=status_code, headers=headers, media_type=ctx.media_type)
	if isinstance(result, str):
		return PlainTextResponse(result, status_code=status_code, headers=headers)
	if result is None:
		return Response(status_code=status_code, headers=headers)

	# best-effort
	return PlainTextResponse(str(result), status_code=status_code, headers=headers)
