import UIKit
import MapKit

class ViewController: UIViewController, MKMapViewDelegate {

	private lazy var mapView: MKMapView = {
		let mapView = MKMapView()
		mapView.showsCompass = true
		mapView.showsUserLocation = true
		mapView.mapType = .standard
		mapView.showsPointsOfInterest = false
		mapView.showsBuildings = false
		mapView.showsTraffic = false
		return mapView
	}()
	private let tilesOverlay = DGSTileOverlay()

	override func viewDidLoad() {
		super.viewDidLoad()

		self.mapView.insertOverlay(self.tilesOverlay, at: 0, level: .aboveLabels)
		self.mapView.delegate = self
		self.mapView.frame = self.view.bounds
		self.mapView.autoresizingMask = [ .flexibleHeight, .flexibleWidth ]
		self.view.addSubview(self.mapView)

		let center = CLLocationCoordinate2D(latitude: 25.197059, longitude: 55.274051)
		let span = MKCoordinateSpan(latitudeDelta: 0.004, longitudeDelta: 0.004)
		self.mapView.setRegion(MKCoordinateRegion(center: center, span: span), animated: true)

		// Add pins on map
		let annotation1 = MKPointAnnotation()
		annotation1.coordinate = center
		let annotation2 = MKPointAnnotation()
		annotation2.coordinate = CLLocationCoordinate2D(latitude: 25.197059, longitude: 55.275051)
		self.mapView.addAnnotations([ annotation1, annotation2 ])

		// Long press on map to add pin
		let tapGR = UILongPressGestureRecognizer(target: self, action: #selector(ViewController.tap(tapGR:)))
		self.mapView.addGestureRecognizer(tapGR)
	}

	@objc dynamic func tap(tapGR: UITapGestureRecognizer) {
		guard tapGR.state == .recognized else { return }

		let taplocation = tapGR.location(in: tapGR.view)

		let annotation = MKPointAnnotation()
		annotation.coordinate = self.mapView.convert(taplocation, toCoordinateFrom: self.mapView)
		self.mapView.addAnnotation(annotation)
	}

	// MARK: MKMapViewDelegate

	public func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
		return MKTileOverlayRenderer(overlay: overlay)
	}

	func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
		guard !annotation.isKind(of: MKUserLocation.self) else {
			return nil
		}
		var annotationView: MKAnnotationView?

		if annotation.isKind(of: MKPointAnnotation.self) {
			let identifier = "Identifier"
			annotationView = mapView.dequeueReusableAnnotationView(withIdentifier: identifier)
			if annotationView == nil {
				let pinAnnotation = MKPinAnnotationView(annotation: annotation, reuseIdentifier: identifier)
				pinAnnotation.animatesDrop = true
				pinAnnotation.pinTintColor = .green
				annotationView = pinAnnotation
			}
		}

		return annotationView
	}

	func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
		mapView.deselectAnnotation(view.annotation, animated: true)

		let ac = UIAlertController(title: "You select pin", message: nil, preferredStyle: .alert)
		ac.addAction(UIAlertAction(title: "Ok", style: .cancel, handler: nil))
		self.present(ac, animated: true, completion: nil)
	}

	func mapView(_ mapView: MKMapView, regionDidChangeAnimated animated: Bool) {
		if mapView.camera.altitude < 700 && !self.isModifyingZoom {
			mapView.camera.altitude = 700
		}

	}

}

