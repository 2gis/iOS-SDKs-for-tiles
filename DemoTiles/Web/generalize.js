L.MarkerGeneralizeGroup = L.FeatureGroup.extend({
    options: {
        levels: [
            {
                margin: 0,
                safeZone: 5,
                size: [16, 16],
                offset: [8, 8],
                className: '_pin'
            },
            {
                safeZone: 0,
                className: '_hidden'
            }
        ],
        checkMarkersIntersection: function(currentMarker, checkingMarker) {
            var distance = Math.max(currentMarker.safeZone, checkingMarker.margin);
            return Math.abs(currentMarker.markerX - checkingMarker.markerX) > (distance + currentMarker.markerWidth / 2 + checkingMarker.markerWidth / 2)
                || Math.abs(currentMarker.markerY - checkingMarker.markerY) > (distance + currentMarker.markerHeight / 2 + checkingMarker.markerHeight / 2);
        },
        checkMarkerMinimumLevel: function() {
            return 0;
        }
    },
    initialize: function(options) {
        L.Util.setOptions(this, options);

        this._layers = {};

        this._markers = {};
        this._priorityMarkers = [];
        this._otherMarkers = [];
        this._selectedMarker;
        this._isMarkersSelectable;
        this._calculationBusy = false;
        this._calculationQueued = false;

        this._zoomReady = {};

        for (var i = 0; i < this.options.levels.length; i++) {
            this._markers[i] = [];
        }

        var levelId, k, level;
        for (levelId = 0; levelId < this.options.levels.length; levelId++) {
            level = this.options.levels[levelId];
            level.markerOffset = [];
            level.markerDistance = [];

            if (!level.size) {
                level.size = [0, 0];
            }

            if (!level.offset) {
                level.offset = [level.size[0] / 2, level.size[1] /2];
            }

            for (k = 0; k < 2; k++) {
                level.markerOffset[k] = level.size[k] / 2 - level.offset[k];
            }
        }

        this.on('invalidationFinish', function() {
            this._map.getPanes().markerPane.style.display = 'block';
        });
    },

    _addLayer: function(layer) {
        layer._positions = {};

        if (layer.showAlways) {
            this._priorityMarkers.push(layer);
        } else {
            this._otherMarkers.push(layer);
        }

        L.LayerGroup.prototype.addLayer.call(this, layer);
    },

    _prepareMarker: function(layer) {
        var markerPoint,
            zoom = this._maxZoom;
        for (; zoom >= 0; zoom--) {
            markerPoint = this._map.project(layer.getLatLng(), zoom); // calculate pixel position
            layer._positions[zoom] = markerPoint;
            layer.options.classForZoom = [];
        }
    },

    _calculateMarkersClassForEachZoom: function() {
        var that = this;

        if (this._calculationBusy) {
            this._calculationQueued = true;
            return;
        }
        this._calculationBusy = true;
        this._zoomReady = {};

        this._maxZoom = this._map.getMaxZoom();

        var currentZoom = this._map.getZoom();
        var maxZoom = that._map.getMaxZoom();
        var zoomsToCalculate = [];
        for (var z = 1; z <= maxZoom; z++) {
            if (z != currentZoom) {
                zoomsToCalculate.push(z);
            }
        }
        zoomsToCalculate.sort(function(a, b) {
            return Math.abs(currentZoom - a) - Math.abs(currentZoom - b);
        });

        this._calculateMarkersClassForZoom(currentZoom, function() {
            // current zoom is ready
            L.Util.UnblockingFor(function(zoomIndex, cb) {
                var z = zoomsToCalculate[zoomIndex];
                that._calculateMarkersClassForZoom(z, cb);
            }, maxZoom - 1, function() {
                that._calculationBusy = false;
                if (that._calculationQueued) {
                    that._calculationQueued = false;
                    that._calculateMarkersClassForEachZoom();
                }
            });
        });
    },

    /**
     * Start calculation marker styles on passed zoom
     * @param zoom {Number}  - for which zoom calculate styles
     * @param callback {Function} - calls when calculation finished
     * @private
     */
    _calculateMarkersClassForZoom: function(zoom, callback) {
        var i, currentLevel, currentMarker,
            ops = this.options,
            that = this;

        var bounds = this._getPixelBoundsForZoom(zoom);

        for (i = 0; i < ops.levels.length; i++) {
            this._markers[i] = [];
        }

        var tree = new L.Util.Quadtree(bounds);

        currentLevel = ops.levels[0];

        for (i = 0; i < this._priorityMarkers.length; i++) {
            currentMarker = this._prepareMarker(i);
            this._markers[currentLevel].push(currentMarker);
            tree.insert(makeNode(currentMarker, currentLevel));
        }

        var items, pendingMarkers = [],
            seekMarkers = this._otherMarkers.slice();

        L.Util.UnblockingFor(processAllMarkers, ops.levels.length, updateMarkerStyles);

        function processAllMarkers(levelIndex, levelsCallback) {
            currentLevel = ops.levels[levelIndex];

            if (ops.levels[levelIndex].size[0] == 0 && ops.levels[levelIndex].size[1] == 0) {
                that._markers[levelIndex] = seekMarkers.slice();
                levelsCallback();
                return;
            }

            var markersInBucket = 200;
            var totalMarkesCount = seekMarkers.length;
            var iterationsCount = Math.ceil(totalMarkesCount / markersInBucket);

            L.Util.UnblockingFor(processBucket, iterationsCount, onBucketFinish);

            function processBucket(bucketIndex, markersCallback) {
                for (var i = markersInBucket * bucketIndex; i < markersInBucket * (bucketIndex + 1) && i < totalMarkesCount; i++) {
                    if (that.options.checkMarkerMinimumLevel(seekMarkers[i]) <= levelIndex) {
                        currentMarker = makeNode(seekMarkers[i], currentLevel);
                        items = tree.retrieve(currentMarker);

                        if (that._validateGroup(currentMarker, items)) {
                            tree.insert(currentMarker);
                            that._markers[levelIndex].push(seekMarkers[i]);
                        } else {
                            pendingMarkers.push(seekMarkers[i]);
                        }
                    } else {
                        pendingMarkers.push(seekMarkers[i]);
                    }
                }
                markersCallback();
            }

            function onBucketFinish() {
                seekMarkers = pendingMarkers.slice();
                pendingMarkers = [];
                levelsCallback();
            }
        }

        function updateMarkerStyles() {
            var groupInd, markerInd, group, groupClass, currMarker;
            for (groupInd = 0; groupInd < that.options.levels.length; groupInd++) {
                groupClass = that.options.levels[groupInd].className;
                group = that.options.levels[groupInd];
                for (markerInd = 0; markerInd < that._markers[groupInd].length; markerInd++) {
                    currMarker = that._markers[groupInd][markerInd];
                    currMarker.options.classForZoom[zoom] = groupClass;
                }
            }
            that._zoomReady[zoom] = true;
            // if finish calculate styles for current level
            if (that._map.getZoom() == zoom) that._invalidateMarkers();
            callback();
        }

        function makeNode(marker, level) {
            var safeZone = level.safeZone || 0;
            var margin = level.margin || 0;
            // For the worst scenario
            var sizeAddition = Math.max(safeZone, margin);
            return {
                safeZone: safeZone,
                margin: margin,
                x: marker._positions[zoom].x - level.offset[0] - sizeAddition,
                y: marker._positions[zoom].y - level.offset[1] - sizeAddition,
                height: level.size[1] + sizeAddition * 2,
                width: level.size[0] + sizeAddition * 2,
                markerX: marker._positions[zoom].x + level.markerOffset[0],
                markerY: marker._positions[zoom].y + level.markerOffset[1],
                markerHeight: level.size[1],
                markerWidth: level.size[0]
            };
        }
    },

    /**
     * Return pixel bounds of all markers for passed zoom
     * @param zoom {Number}
     * @returns {{x: Number, y: Number, width: number, height: number}}
     * @private
     */
    _getPixelBoundsForZoom: function(zoom) {
        var markerPos,
            minX = Number.MAX_VALUE,
            minY = Number.MAX_VALUE,
            maxX = 0,
            maxY = 0;

        this.eachLayer(function(marker) {
            markerPos = marker._positions[zoom];
            minX = Math.min(minX, markerPos.x);
            minY = Math.min(minY, markerPos.y);
            maxX = Math.max(maxX, markerPos.x);
            maxY = Math.max(maxY, markerPos.y);
        });

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    },

    /**
     * Check if marker intersect found markers from tree
     * @param currMarker
     * @param items
     * @returns {boolean}
     * @private
     */
    _validateGroup: function(currMarker, items) {
        if (items.length == 0) return true;
        var i, ops = this.options;

        for (i = 0; i < items.length; i++) {
            if (!ops.checkMarkersIntersection(currMarker, items[i])) {
                return false;
            }
        }
        return true;
    },

    /**
     * set marker classes on current zoom
     * @private
     */
    _invalidateMarkers: function() {
        var groupClass, zoom = this._map.getZoom();

        if (!this._zoomReady[zoom]) return;

        this.eachLayer(function(marker) {
            if (marker === this._selectedMarker) {
                return;
            }
            groupClass = marker.options.classForZoom[zoom];
            if (!groupClass) return; //not ready yet
            if (marker.options.state != groupClass) {
                if (marker.options.state) {
                    L.DomUtil.removeClass(marker._icon, marker.options.state);
                }
                L.DomUtil.addClass(marker._icon, groupClass);
                marker.options.state = groupClass;
            }
        }, this);
        this.fireEvent('invalidationFinish');
    },

    _hideMarkersOutOfViewPort: function() {
        var currentZoom = this._map.getZoom();
        var pixelBounds = this._map.getPixelBounds();
        var width = pixelBounds.max.x - pixelBounds.min.x;
        var height = pixelBounds.max.y - pixelBounds.min.y;
        this.eachLayer(function(marker) {
            var markerPos = marker._positions[currentZoom];
            if (markerPos !== undefined) {
                if (markerPos.x > pixelBounds.min.x - width &&
                    markerPos.x < pixelBounds.max.x + width &&
                    markerPos.y > pixelBounds.min.y - height &&
                    markerPos.y < pixelBounds.max.y + height) {
                    L.DomUtil.removeClass(marker._icon, '_outOfViewPort');
                } else {
                    L.DomUtil.addClass(marker._icon, '_outOfViewPort');
                }
            }
        });
    },

    _zoomStart: function() {
        this._map.getPanes().markerPane.style.display = 'none';
    },

    _zoomEnd: function() {
        this._invalidateMarkers();
        this._hideMarkersOutOfViewPort();
        window.location = 'js-call://jscall?type=zoomLevelChanged'
            + '&current_zoom=' + this._map.getZoom()
            + '&min_zoom=' + this._map.getMinZoom()
            + '&max_zoom=' + this._map.getMaxZoom();
    },

    _dragEnd: function() {
        this._hideMarkersOutOfViewPort();
    },

    addLayer: function(layer) {
        this._addLayer(layer);
        if (this._map) {
            this._prepareMarker(layer);
            this._calculateMarkersClassForEachZoom();
            this._invalidateMarkers();
        }
        return this;
    },

    addLayers: function(layersArray) {
        var i;
        for (i = 0; i < layersArray.length; i++) {
            this._addLayer(layersArray[i]);
        }

        if (this._map) {
            this.eachLayer(this._prepareMarker, this);
            this._calculateMarkersClassForEachZoom();
        }
        return this;
    },

    _removeLayer: function(layer) {
        var beforeLength = this._layers.length;
        L.LayerGroup.prototype.removeLayer.call(this, layer);
        return beforeLength - this._layers.length != 0;
    },

    removeLayer: function(layer) {
        if (this._removeLayer(layer)) {
            this._calculateMarkersClassForEachZoom();
            this._invalidateMarkers();
        }

        return this;
    },

    onAdd: function(map) {
        this._map = map;
        this._maxZoom = this._map.getMaxZoom();

        map.on('zoomstart', this._zoomStart, this);
        map.on('zoomend', this._zoomEnd, this);
        map.on('dragend', this._dragEnd, this);

        this.eachLayer(this._prepareMarker, this);
        this._calculateMarkersClassForEachZoom();
        L.LayerGroup.prototype.onAdd.call(this, map);
    },

    onRemove: function(map) {
        if (!this._map) return;
        map.off('zoomstart', this._zoomStart, this);
        map.off('zoomend', this._zoomEnd, this);
        map.off('dragend', this._dragEnd, this);
        
        L.LayerGroup.prototype.onRemove.call(this, map);

        this.eachLayer(function(marker) {
            marker.options.state = '';
        });

        this._map = null;
    },

    clearLayers: function () {
        var i;
        for (i in this._layers) {
            this._removeLayer(this._layers[i]);
        }

        this._markers = {};
        for (i = 0; i < this.options.levels.length; i++) {
            this._markers[i] = [];
        }
        this._priorityMarkers = [];
        this._otherMarkers = [];
        return this;
    }

});

L.markerGeneralizeGroup = function (option) {
    return new L.MarkerGeneralizeGroup(option);
};

L.Util.UnblockingFor = function(iterator, times, callback) {
    callback = callback || function() {};

    var index = 0;
    next(index);

    function next(i) {
        setTimeout(function() {
            iterator(i, cb);
        }, 0);
    }

    function cb() {
        index++;
        if (index < times) {
            next(index);
        } else {
            callback();
        }
    }

};
