import rhpy
from rhpy.web import HTTPContext, RouteDecorators
from receivers import receivers


router = RouteDecorators()

@router.post('/', body=rhpy.SensorValue)
async def handle_post(ctx: HTTPContext, body: rhpy.SensorValue):
	matches = receivers.receive(body)

	log_extra = body.value if isinstance(body.value, dict) else { 'value': body.value }
	ctx.log.info(f'Found {matches} receivers for {body.name}', extra=log_extra)


# TODO add redis handlers here too
