import MapKit

public class DGSTileOverlay: MKTileOverlay {

	private let isRetina: Bool
	private let cache = NSCache<NSURL, NSData>()
	private let urlSession = URLSession(configuration: URLSessionConfiguration.default)

	override public func url(forTilePath path: MKTileOverlayPath) -> URL {
		if self.isRetina {
			return URL(string: String(format: "https://rtile2.maps.2gis.com/tiles?x=%d&y=%d&z=%d&v=1", path.x, path.y, path.z))!
		} else {
			return URL(string: String(format: "https://tile2.maps.2gis.com/tiles?x=%d&y=%d&z=%d&v=1", path.x, path.y, path.z))!
		}
	}

	internal init(isRetina: Bool = true) {
		self.isRetina = isRetina
		super.init(urlTemplate: nil)
		if isRetina {
			self.tileSize = CGSize(width: 512, height: 512)
		} else {
			self.tileSize = CGSize(width: 256, height: 256)
		}
		self.canReplaceMapContent = true
		self.maximumZ = 18
	}

	override public func loadTile(at path: MKTileOverlayPath, result: @escaping (Data?, Error?) -> Void) {
		let url = self.url(forTilePath: path)

		if let cachedData = self.cache.object(forKey: url as NSURL) as Data? {
			result(cachedData, nil)
		} else {
			let task = self.urlSession.dataTask(with: url, completionHandler: {
				[weak self] (data, response, error) in
				if let data = data {
					let image = UIImage(data: data)
					print(image?.scale)
					self?.cache.setObject(data as NSData, forKey: url as NSURL)
				}
				result(data, error)
			})
			task.resume()
		}
	}



}

