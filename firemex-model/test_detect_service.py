"""HTTP contract tests use an explicit stub; they do not measure model quality."""
import io
import threading
import time
import unittest
from unittest.mock import patch
from PIL import Image
from fastapi.testclient import TestClient
import detect_service as service


class Box:
    conf = [.8]
    cls = [0]
    xyxy = [[1, 1, 20, 20]]


class FakeModel:
    names = {0: 'fire', 1: 'smoke'}
    boxes = [Box()]
    def __call__(self, frame, **kwargs):
        self.kwargs = kwargs
        return [self]


class Contract(unittest.TestCase):
    def setUp(self):
        self.fake = FakeModel()
        service.model = self.fake
        service.model_version = 'stub-contract-only'
        self.client = TestClient(service.app)
        stream = io.BytesIO()
        Image.new('RGB', (32, 32)).save(stream, format='JPEG')
        self.raw = stream.getvalue()

    def post(self, raw=None, **data):
        return self.client.post('/detect', files={'image': ('sample.jpg', self.raw if raw is None else raw, 'image/jpeg')}, data=data)

    def test_threshold_annotation_and_identity(self):
        response = self.post(threshold='.2', annotate='true')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['hazard'])
        self.assertIn('annotated_image', response.json())
        self.assertEqual(response.json()['model_version'], 'stub-contract-only')
        self.assertEqual(self.fake.kwargs['conf'], .2)
        self.assertEqual(self.fake.kwargs['device'], 'cpu')

    def test_negative(self):
        self.fake.boxes = []
        response = self.post()
        self.assertEqual(response.json()['detections'], [])
        self.assertFalse(response.json()['hazard'])

    def test_invalid_inputs(self):
        self.assertEqual(self.post(b'broken').status_code, 400)
        self.assertEqual(self.post(threshold='nan').status_code, 422)
        self.assertEqual(self.post(threshold='1.2').status_code, 422)
        self.assertEqual(self.post(b'x' * (service.MAX_BYTES + 1)).status_code, 413)
        self.assertEqual(self.post(b'x' * (service.MAX_BYTES + 65537)).status_code, 413)
        with patch.object(service, 'MAX_PIXELS', 10):
            self.assertEqual(self.post().status_code, 400)

    def test_health_and_single_flight(self):
        entered = threading.Event()
        release = threading.Event()
        class Slow(FakeModel):
            def __call__(self, frame, **kwargs):
                entered.set(); release.wait(2)
                return super().__call__(frame, **kwargs)
        service.model = Slow()
        thread = threading.Thread(target=lambda: self.post())
        thread.start(); self.assertTrue(entered.wait(1))
        start = time.monotonic()
        self.assertEqual(self.client.get('/health').status_code, 200)
        self.assertLess(time.monotonic() - start, .5)
        self.assertEqual(self.post().status_code, 503)
        release.set(); thread.join()


if __name__ == '__main__':
    unittest.main()
