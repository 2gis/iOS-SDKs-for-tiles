import UIKit
import CoreLocation

struct Marker {
	let id: Int
	let selected: Bool
	let location: CLLocationCoordinate2D
}

class WebMapVC: UIViewController, UIWebViewDelegate {

	lazy var webView = UIWebView()
	private var isMapLoaded = false
	private var markers = [Marker]()

	override func viewDidLoad() {
		super.viewDidLoad()

		self.webView.frame = self.view.bounds
		self.webView.scrollView.isScrollEnabled = false
		self.webView.dataDetectorTypes = []
		self.webView.delegate = self
		self.view.addSubview(self.webView)

		let pageControl = UISegmentedControl(items: [" – ", " + "])
		pageControl.isMomentary = true
		pageControl.addTarget(self, action: #selector(self.pageChanged(_:)), for: .valueChanged)
		self.navigationItem.rightBarButtonItem = UIBarButtonItem(customView: pageControl)

		self.loadMap(startLocation: CLLocationCoordinate2D(latitude: 54.99741, longitude: 82.878113))

		self.addMarkers([
			Marker(id: 1, selected: false, location: CLLocationCoordinate2D(latitude: 54.99741, longitude: 82.878113)),
			Marker(id: 2, selected: false, location: CLLocationCoordinate2D(latitude: 54.99941, longitude: 82.878113))
			])
	}

	private func loadMap(startLocation: CLLocationCoordinate2D, zoomLevel: Int = 16) {
		let url = Bundle.main.url(forResource: "GisMapViewHtml", withExtension: "html")!
		var html = String(data: try! Data(contentsOf: url), encoding: .utf8)!
		html = html.replacingOccurrences(of: "HTML_USER_AVATAR_TEMPLATE", with: "point-guest.svg")
		html = html.replacingOccurrences(of: "HTML_LAT_TEMPLATE", with: "\(startLocation.latitude)")
		html = html.replacingOccurrences(of: "HTML_LON_TEMPLATE", with: "\(startLocation.longitude)")
		html = html.replacingOccurrences(of: "HTML_ZOOM_TEMPLATE", with: "\(zoomLevel)")
		self.webView.loadHTMLString(html, baseURL: Bundle.main.bundleURL)
	}

	@objc func pageChanged(_ pageControl: UISegmentedControl) {
		if pageControl.selectedSegmentIndex == 0 {
			self.zoomOut()
		} else {
			self.zoomIn()
		}
	}

	// MARK: Helpers


	func removeMarkers() {
		self.execute("removeMarkers();")
	}

	func addMarkers(_ markers: [Marker]) {
		self.markers = markers
		self.addMarkersToMap()
	}

	func addMarkersToMap() {
		guard self.isMapLoaded else { return }

		let str = self.markers.map { m -> String in
			return """
			[\(m.location.latitude), \(m.location.longitude), "0.000000", ["\(m.id)"], 1, "1"]
			"""
		}
		let markers = str.joined(separator: ", ")

		self.execute("setMarkers([\(markers)]);")
	}

	@objc func zoomIn() {
		self.execute("zoomIn();")
	}

	@objc func zoomOut() {
		self.execute("zoomOut();")
	}

	func markerTouched(_ marker: Marker) {
		print("markerTouched: \(marker)")
	}

	private func execute(_ code: String) {
		self.webView.stringByEvaluatingJavaScript(from: code)
	}

	// MARK: UIWebViewDelegate

	func webView(_ webView: UIWebView, shouldStartLoadWith request: URLRequest, navigationType: UIWebView.NavigationType) -> Bool {
		if let url = request.url,
			let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
			components.scheme == "js-call" {

			var query = [String: String]()
			components.queryItems?.forEach({ (item) in
				if let value = item.value {
					query[item.name] = value
				}
			})

			let type = query["type"]
			if type == "mapDidLoaded" {

				self.isMapLoaded = true
				let markersSelectable: Int = 1
				self.execute("setMarkersSelectable(\(markersSelectable));")
				self.addMarkersToMap()
			} else if type == "markerTouched" {

				if let lons = query["lon"], let lon = CLLocationDegrees(lons),
					let lats = query["lat"], let lat = CLLocationDegrees(lats),
					let selecteds = query["selected"], let selected = Int(selecteds),
					let filial_ids = query["filial_ids"], let id = Int(filial_ids) {

					let location = CLLocationCoordinate2D(latitude: lat, longitude: lon)
					let marker = Marker(id: id, selected: selected > 0, location: location)
					self.markerTouched(marker)
				}

			} else if type == "zoomLevelChanged",
				let currentZoom = query["current_zoom"],
				let minZoom = query["min_zoom"],
				let maxZoom = query["max_zoom"] {
				print("zoomLevelChanged: \(currentZoom) \(minZoom) \(maxZoom)")
			}
			return false
		}
		return navigationType != .linkClicked
	}

}
