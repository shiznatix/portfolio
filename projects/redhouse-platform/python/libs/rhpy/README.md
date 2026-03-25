# rhpy

A lightweight Python microservice framework with built-in HTTP routing, Pydantic validation, Prometheus metrics, structured logging, and graceful shutdown.

## Features

- **Decorator-based HTTP Routes**: Simple `@get`, `@post`, etc. decorators with automatic Pydantic validation
- **Pydantic Configuration**: Type-safe config with automatic camelCase to snake_case conversion
- **File Upload Support**: Built-in handling for multipart/form-data file uploads
- **Static File Serving**: Serve public HTML, JS, CSS with `@public` decorator
- **Health Check**: Default `/health` endpoint
- **Prometheus Metrics**: Optional metrics server
- **Graceful Shutdown**: Signal handling and clean resource cleanup
- **Structured Logging**: logfmt-based logging with context
- **Thread Management**: Built-in thread lifecycle management

## Installation

```bash
pip install rhpy
```

## Quick Start

### Minimal Service

```python
import rhpy

# Start with defaults
rhpy.run()
```

Requires `config.json` in project root:

```json
{
  "ports": {
    "http": 8080
  }
}
```

### With Custom Config

Define your config by extending `rhpy.Config`:

```python
import rhpy

class ServiceConfig(rhpy.Config):
    api_key: str
    database_url: str
    timeout: int = 30

# Load config (returns validated instance)
config = rhpy.load(ServiceConfig)

# Use config throughout your service
print(config.api_key)
print(config.timeout)

rhpy.run()
```

Your `config.json`:

```json
{
  "ports": {
    "http": 8080,
    "prometheus": 9090
  },
  "apiKey": "your-key",
  "databaseUrl": "postgresql://localhost/db",
  "timeout": 60
}
```

Note: JSON keys are automatically converted from camelCase to snake_case.

### HTTP Routes with Validation

Use decorators to define routes with automatic Pydantic validation:

```python
import rhpy

class CreateItemBody(rhpy.Model):
    name: str
    description: str
    price: float

@rhpy.post('/items', body=CreateItemBody)
def create_item(ctx: rhpy.HTTPContext, body: CreateItemBody):
    ctx.log.info('Creating item', extra={'name': body.name})

    # Your business logic here
    item_id = save_to_database(body)

    return {'id': item_id, 'name': body.name}

@rhpy.get('/items/<item_id:int>')
def get_item(ctx: rhpy.HTTPContext, item_id: int):
    item = fetch_from_database(item_id)
    return item

@rhpy.delete('/items/<item_id:int>')
def delete_item(item_id: int):
    # ctx parameter is optional - omit if not needed
    delete_from_database(item_id)
    return {'deleted': True}

rhpy.run()
```

### File Uploads

Handle file uploads by typing fields as `bytes`:

```python
import rhpy

class UploadRequest(rhpy.Model):
    title: str
    file: bytes  # File upload

@rhpy.post('/upload', body=UploadRequest)
def upload_file(body: UploadRequest):
    # body.file contains the uploaded file bytes
    file_size = len(body.file)

    with open(f'/uploads/{body.title}', 'wb') as f:
        f.write(body.file)

    return {'uploaded': body.title, 'size': file_size}
```

### Static File Serving

Serve HTML, CSS, JS files:

```python
import rhpy

# Serve from ./public directory (default)
@rhpy.public
def serve_public():
    pass

# Or specify custom directory
@rhpy.public(root='./static')
def serve_static():
    pass

# Access at:
# http://localhost:8080/          -> serves index.html
# http://localhost:8080/app.js    -> serves app.js
# http://localhost:8080/style.css -> serves style.css
```

### Full Example

```python
import rhpy
from pathlib import Path

log = rhpy.logger('myservice')

class ServiceConfig(rhpy.Config):
    api_key: str
    max_workers: int = 4

class ProcessRequest(rhpy.Model):
    text: str
    lang: str = 'en'

# Load config
config = rhpy.load(ServiceConfig)

@rhpy.get('/status')
def status():
    return {
        'status': 'running',
        'workers': config.max_workers
    }

@rhpy.post('/process', body=ProcessRequest)
def process_text(ctx: rhpy.HTTPContext, body: ProcessRequest):
    ctx.log.info('Processing text', extra={'lang': body.lang})

    result = do_processing(body.text, body.lang)

    return {'result': result}

@rhpy.public(root='./public')
def serve_ui():
    pass

def on_start():
    log.info('Service initialized', extra={
        'config': config.model_dump()
    })

rhpy.run(init=on_start)
```

## API Reference

### Configuration

#### `rhpy.Config`

Base class for service configuration. Extend it with your own fields:

```python
class ServiceConfig(rhpy.Config):
    field1: str
    field2: int = 10
```

Features:
- Pydantic BaseModel with validation
- Automatic camelCase → snake_case conversion from JSON
- Frozen (immutable) by default

#### `rhpy.load(config_class, file_name='config.json')`

Load and validate configuration from JSON file:

```python
config = rhpy.load(ServiceConfig)  # Loads from config.json
config = rhpy.load(ServiceConfig, 'dev.json')  # Custom file
```

Returns validated config instance.

#### `rhpy.ports()`

Get port configuration:

```python
ports = rhpy.ports()
print(ports.http)        # HTTP server port
print(ports.prometheus)  # Prometheus port (or None)
```

### Routing

#### Route Decorators

- `@rhpy.get(path, body=None)` - GET request
- `@rhpy.post(path, body=None)` - POST request
- `@rhpy.put(path, body=None)` - PUT request
- `@rhpy.delete(path, body=None)` - DELETE request
- `@rhpy.route(path, method='GET', body=None)` - Generic route

Parameters:
- `path`: URL path with optional Bottle-style parameters (`/items/<id:int>`)
- `body`: Optional Pydantic model for request body validation

Handler signature:
```python
def handler(ctx: rhpy.HTTPContext, body: Model, **path_params):
    # ctx and body are optional kwargs
    # path_params are URL path parameters
    pass
```

#### `@rhpy.public(root='./public')`

Serve static files:

```python
@rhpy.public                    # Serve from ./public
@rhpy.public(root='./static')   # Custom directory
```

Matches: `/<filename:re:(.*\.(js|css|ico|html))?>`
Empty path serves `index.html`.

### HTTP Context

#### `rhpy.HTTPContext`

Available as `ctx` keyword argument in handlers:

```python
@rhpy.get('/path')
def handler(ctx: rhpy.HTTPContext):
    ctx.log.info('Request received')
    ctx.status = 404
    body_bytes = ctx.body
```

Properties:
- `ctx.log`: Scoped logger for this request
- `ctx.status`: Get/set HTTP status code
- `ctx.body`: Request body (bytes)
Properties:
- `ctx.log`: Scoped logger for this request
- `ctx.status`: Get/set HTTP status code
- `ctx.body`: Request body (bytes)

Methods:
- `ctx.audio(file_path, audio_type)`: Return audio file with proper headers

### Models

#### `rhpy.Model`

Base class for Pydantic models with automatic camelCase conversion:

```python
class MyModel(rhpy.Model):
    field_name: str
    another_field: int = 10

# JSON with camelCase is converted to snake_case
data = MyModel(**{"fieldName": "test", "anotherField": 20})
print(data.field_name)  # "test"

# Export back to dict
data.to_dict()  # {"field_name": "test", "another_field": 20}
```

### Service Lifecycle

#### `rhpy.run(init=None)`

Start the service:

```python
def on_start():
    print("Service starting!")

rhpy.run(init=on_start)  # Optional init callback
```

The `init` callback runs after HTTP/Prometheus servers start but before entering the main loop.

#### `rhpy.is_quit()`

Check if shutdown signal received:

```python
if rhpy.is_quit():
    cleanup()
```

#### `rhpy.quit()`

Trigger graceful shutdown:

```python
rhpy.quit()
```

#### `rhpy.wait(timeout)`

Wait for shutdown signal with timeout:

```python
rhpy.wait(1)  # Wait 1 second
```

### Logging

#### `rhpy.logger(name)`

Get a structured logger:

```python
log = rhpy.logger('myservice')

log.info('Message', extra={'key': 'value'})
log.error('Error occurred', extra={'error_code': 404})
log.warning('Warning message')
log.debug('Debug info')
```

Outputs logfmt format structured logs.

### Thread Management

#### `rhpy.threads`

Global thread manager:

```python
import threading

def worker():
    while not rhpy.is_quit():
        do_work()

thread = threading.Thread(target=worker)
rhpy.threads.append(thread, start=True)

# Later: cleanup joins all threads
```

Methods:
- `threads.append(thread, start=True)`: Register and optionally start thread
- `threads.join()`: Wait for all threads to complete

### Utilities

#### `rhpy.funcs.camel_to_snake(data)`

Convert camelCase to snake_case:

```python
from rhpy import funcs

funcs.camel_to_snake("myFieldName")  # "my_field_name"
funcs.camel_to_snake({"myField": 1})  # {"my_field": 1}
funcs.camel_to_snake([{"myField": 1}])  # [{"my_field": 1}]
```

#### `rhpy.funcs.snake_to_camel(data)`

Convert snake_case to camelCase:

```python
funcs.snake_to_camel("my_field_name")  # "myFieldName"
funcs.snake_to_camel({"my_field": 1})  # {"myField": 1}
```

#### Time utilities

```python
from rhpy import funcs

funcs.days_elapsed(timestamp)     # Days since timestamp
funcs.seconds_elapsed(timestamp)  # Seconds since timestamp (rounded)
funcs.days_to_seconds(days)       # Convert days to seconds
```

#### Network info

```python
from rhpy import funcs

hostname, ips = funcs.get_network_info()
# hostname: str
# ips: list of non-local IP addresses
```

### Config Helpers

#### `rhpy.print_config()`

Print loaded config in table format:

```python
rhpy.print_config()
# Outputs:
# |==========================================|
# | Variable        | Value                  |
# | ----------------+----------------------- |
# | api_key         | my-key                 |
# | max_workers     | 4                      |
# |==========================================|
```

## Configuration File

The config JSON file should be in your project root. Required structure:

```json
{
  "ports": {
    "http": 8080,
    "prometheus": 9090
  },
  "yourCustomFields": "values"
}
```

- `ports.http`: **Required** - HTTP server port
- `ports.prometheus`: **Optional** - Prometheus metrics port (omit to disable)
- Custom fields: Use camelCase in JSON, accessed as snake_case in Python

## Best Practices

### Typed Config Access

Store config instance at module level for typed access:

```python
# main.py
import rhpy

class ServiceConfig(rhpy.Config):
    api_key: str
    timeout: int = 30

# Load once at startup
config = rhpy.load(ServiceConfig)

# main.py or config.py - export for other modules
__all__ = ['config']
```

```python
# handlers.py
from main import config

def handler():
    # Fully typed access
    key = config.api_key
```

### Error Handling

Validation errors automatically return formatted messages:

```python
@rhpy.post('/create', body=CreateRequest)
def create(body: CreateRequest):
    # If validation fails, user gets:
    # {"error": ["field_name - Field required", ...]}
    pass
```

### Logging Context

Use HTTPContext logger for request-scoped logging:

```python
@rhpy.post('/process', body=ProcessRequest)
def process(ctx: rhpy.HTTPContext, body: ProcessRequest):
    ctx.log.info('Processing', extra={'user_id': body.user_id})
    # Logs include request method and path
```

### Graceful Workers

Make background workers respect shutdown:

```python
import rhpy

def worker():
    while not rhpy.is_quit():
        do_work()
        rhpy.wait(5)  # Check shutdown every 5 seconds

thread = threading.Thread(target=worker)
rhpy.threads.append(thread, start=True)
```

## Default Routes

- `GET /health` - Returns `"ok"` for health checks

## Built on

- **Bottle**: WSGI micro web framework
- **Waitress**: Production WSGI server
- **Pydantic**: Data validation using Python type hints
- **Prometheus Client**: Metrics collection
- **logfmter**: Structured logging
## License

MIT
