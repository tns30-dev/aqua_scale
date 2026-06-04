"""
Phase 5 verification — exercises all three module_sensor admin forms' validation
against the live dev DB (managed=False models have no Django-migration test DB,
so we verify on the real schema, same approach used across this refinement).

Run:  ./venv/bin/python manage.py shell < sensor_module_reference/phase5_verification.py
Expected: all PASS.
"""
from django.contrib.admin.sites import site

from module_project.models import ParameterType
from module_sensor.admin import IoTDeviceAdmin
from module_sensor.forms import ProjectSensorAdminForm, SensorTypeAdminForm
from module_sensor.models import IoTDevice, ProjectSensor, SensorType


def ok(label, cond):
    print(("PASS" if cond else "FAIL"), "-", label)


# --- SensorType ---
st = SensorType.objects.first()
pid = str(ParameterType.objects.first().parameter_id)
f = SensorTypeAdminForm(data={"name": "X", "model_number": st.model_number, "parameter_ids": [pid]})
ok("SensorType dup model_number rejected", not f.is_valid() and "model_number" in f.errors)
f2 = SensorTypeAdminForm(data={"name": "X", "parameter_ids": []})
ok("SensorType empty parameter_ids rejected", not f2.is_valid() and "parameter_ids" in f2.errors)

# --- IoTDevice ---
FormCls = IoTDeviceAdmin(IoTDevice, site).get_form(None)
dev = IoTDevice.objects.first()
ok("IoTDevice dup device_code rejected",
   not FormCls(data={"device_code": dev.device_code, "device_name": "X", "status": "online", "config": "{}"}).is_valid())
ok("IoTDevice bad status rejected",
   not FormCls(data={"device_code": "NEW-Z", "device_name": "X", "status": "bogus", "config": "{}"}).is_valid())

# --- ProjectSensor ---
ps = ProjectSensor.objects.select_related("project", "pond", "sensor_type").first()
base = {
    "project": str(ps.project_id), "pond": str(ps.pond_id),
    "sensor_type": str(ps.sensor_type_id), "serial_number": "TEST-9999", "status": "active",
}
fp = ProjectSensorAdminForm(data={**base, "iot_device": str(dev.iot_device_id)})
ok("ProjectSensor device-without-port rejected", not fp.is_valid() and "port" in fp.errors)

clasher = (ProjectSensor.objects.filter(iot_device__isnull=False, status="active")
           .exclude(port="").exclude(port__isnull=True).first())
if clasher:
    fc = ProjectSensorAdminForm(data={**base, "iot_device": str(clasher.iot_device_id), "port": clasher.port})
    ok("ProjectSensor dup active (device,port) rejected", not fc.is_valid() and "port" in fc.errors)
else:
    print("SKIP - no existing active iot_device+port to clash-test")

ok("ProjectSensor lat-only rejected", not ProjectSensorAdminForm(data={**base, "latitude": 1.0}).is_valid())
ok("ProjectSensor valid (no device) accepted", ProjectSensorAdminForm(data={**base}).is_valid())
