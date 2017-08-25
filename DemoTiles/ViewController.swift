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

		self.mapView.insert(self.tilesOverlay, at: 0, level: .aboveLabels)
		self.mapView.delegate = self
		self.mapView.frame = self.view.bounds
		self.view.addSubview(self.mapView)

		let center = CLLocationCoordinate2D(latitude: 25.197059, longitude: 55.274051)
		let span = MKCoordinateSpan(latitudeDelta: 0.004, longitudeDelta: 0.004)
		self.mapView.setRegion(MKCoordinateRegion(center: center, span: span), animated: true)
	}

	// MARK: MKMapViewDelegate

	public func mapView(_ mapView: MKMapView, rendererFor overlay: MKOverlay) -> MKOverlayRenderer {
		return MKTileOverlayRenderer(overlay: overlay)
	}

}

