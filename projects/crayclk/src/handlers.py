import rhpy
from rhpy.web import RouteDecorators
from state import State


router = RouteDecorators()


@router.post('/faces', body=rhpy.ImageDetections)
async def faces_post(body: rhpy.ImageDetections):
	State.set_detections(len(body.detections) > 0)
	return True


class LightSchema(rhpy.SensorValue):
	class Value(rhpy.Model):
		rc_secs: float
		brightness: float

	value: Value

@router.post('/light', body=LightSchema)
async def light_post(body: LightSchema):
	if body.value.brightness < 0:
		return {'error': 'Invalid brightness value'}, 400
	State.set_brightness(body.value.brightness)
	return True
