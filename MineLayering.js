// ==UserScript==
// @name          Planets.nu - Minefield Layering Plugin
// @namespace     planetsnu/mineFieldLayering
// @version       1.0
// @date          2026-10-18
// @author        sphere300
// @description   A map plugin to make mine layering easier to do
// @include       http://planets.nu/*
// @include       http://play.planets.nu/*
// @include       http://test.planets.nu/*
// @include       https://mobile.planets.nu/*
// @include       https://planets.nu/*

// ==/UserScript==

/*
How it works:
When a ship lays mines, the host looks for your own minefield of the same type whose centre is closest to the
ship. If the ship is inside that closest field the mines are added to it, otherwise a new field is created.
So a point inside one of your fields (A) still gets a NEW field when the centre of another of your fields (B)
is closer than A's centre and the point is outside B. Ships sit on whole light year coordinates, so the overlay
fills every grid square where this holds: inside at least one of your fields, but outside the field whose
centre is nearest.

Change log:
1.0    Initial release [2026-10-18]
*/
function wrapper() { // wrapper for injection

	if (vgap.version < 3.0) {
		console.log("MineLayering plugin requires at least NU version 3.0. Plugin disabled.");
		return;
	}

	var plugin_version = 1.0;

	//map button icon: white mine inside a red "no" circle with a slash
	var hide_mines_icon = "data:image/svg+xml," + encodeURIComponent(
		"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" +
		"<g stroke='#FFFFFF' stroke-width='1.6' stroke-linecap='round'>" +
		"<path d='M12 5.5V18.5M5.5 12H18.5M7.4 7.4L16.6 16.6M16.6 7.4L7.4 16.6'/>" +
		"</g>" +
		"<circle cx='12' cy='12' r='4.2' fill='#FFFFFF'/>" +
		"<circle cx='12' cy='12' r='10' fill='none' stroke='#FF2020' stroke-width='2'/>" +
		"<path d='M4.9 4.9L19.1 19.1' stroke='#FF2020' stroke-width='2' stroke-linecap='round'/>" +
		"</svg>");

	console.log("MineLayering plugin version: v" + plugin_version);

	var mineLayeringPlugin =
	{
		processload: function () {
		},

		loaddashboard: function () {
		},

		showdashboard: function () {
		},

		showsummary: function () {
		},

		/**
		 * loadmap: add the toggle button below the other map buttons
		 */
		loadmap: function () {
			var plugin = vgap.plugins["mineLayeringPlugin"];
			if (!plugin.mobile_version) {
				vgap.map.addMapTool("<span style=\"color:#FFFF00\">Mine Layering</span>", "ShowMinerals", function () { plugin.toggleOverlay(); });
				vgap.map.addMapTool("<span style=\"color:#FF2020\">Hide Minefields</span>", "ShowMinerals", function () { plugin.toggleHideMinefields(); });
				return;
			}

			vgap.map.addMapTool("Minefield Layering", "minelayermenu", function () { plugin.toggleOverlay(); });
			vgap.map.addMapTool("Hide Minefields", "minehidemenu", function () { plugin.toggleHideMinefields(); });

			var head = document.getElementsByTagName('head')[0];
			if (head) {
				var newCss = document.createElement('style');
				newCss.type = "text/css";
				newCss.innerHTML = ".minelayermenu::before { content: \"\\f192\"; color: #FFFFFF }";
				newCss.innerHTML += ".minelayermenu.minelayeractive::before { color: #FFFF00 }";
				newCss.innerHTML += ".minelayermenu.minelayeractive { box-shadow: inset 0 0 0 2px #FFFF00 }";
				newCss.innerHTML += ".minehidemenu::before { content: \"\" }";
				newCss.innerHTML += ".minehidemenu { background-image: url(\"" + hide_mines_icon + "\") !important; background-repeat: no-repeat !important; background-position: center !important; background-size: 55% !important; }";
				newCss.innerHTML += ".minehidemenu.minehideactive { box-shadow: inset 0 0 0 2px #FF2020 }";
				newCss.innerHTML += "#MineLayerTool { position: absolute; right: 50px; z-index: 9; padding: 4px; background: rgba(0,0,0,0.6); color: #FFFFFF; white-space: nowrap; }";
				head.appendChild(newCss);
			}
		},

		showmap: function () {
		},

		/**
		 * draw: executed after NU has drawn the starmap, so the hatching sits above all minefields
		 */
		draw: function () {
			var plugin = vgap.plugins["mineLayeringPlugin"];
			if (plugin.active)
				plugin.drawLayeringRegions();
		},

		loadplanet: function () {
		},

		loadstarbase: function () {
		},

		loadship: function () {
		},

		/***************************************************************************************
		 * Custom plugin variables
		 ***************************************************************************************/

		version: plugin_version,
		mobile_version: (vgap.version >= 4.0),
		active: false,
		hideMinefields: false,
		fieldType: "normal",	//which of your field types to layer: normal, web or hidden
		fillColor: "rgba(255,255,0,0.5)",
		spanCache: null,	//layering grid squares, recomputed when the minefields or field type change

		/***************************************************************************************
		 * Custom plugin methods
		 ***************************************************************************************/

		toggleOverlay: function () {
			this.setActive(!this.active);
		},

		/**
		 * Show or hide all minefields on the starmap
		 */
		toggleHideMinefields: function () {
			this.hideMinefields = !this.hideMinefields;
			$(".minehidemenu").toggleClass("minehideactive", this.hideMinefields);
			vgap.map.draw();
		},

		setActive: function (active) {
			this.active = active;
			$(".minelayermenu").toggleClass("minelayeractive", active);
			if (active && this.mobile_version)
				this.showTool();
			else
				$("#MineLayerTool").remove();
			vgap.map.draw();
		},

		/**
		 * Field type of a minefield, matching how the host groups fields when laying mines
		 */
		getFieldType: function (mf) {
			if (mf.isweb)
				return "web";
			if (mf.ishidden)
				return "hidden";
			return "normal";
		},

		/**
		 * Show a field type selector next to the toggle button when you own more than one type of field
		 */
		showTool: function () {
			var plugin = vgap.plugins["mineLayeringPlugin"];
			$("#MineLayerTool").remove();

			var types = [];
			for (var i = 0; i < vgap.minefields.length; i++) {
				var mf = vgap.minefields[i];
				var type = plugin.getFieldType(mf);
				if (mf.ownerid == vgap.player.id && types.indexOf(type) < 0)
					types.push(type);
			}
			if (types.length < 2)
				return;

			var tool = $("<div id='MineLayerTool'>Layer: </div>");
			var select = $("<select></select>").appendTo(tool);
			for (var t = 0; t < types.length; t++) {
				$("<option></option>").val(types[t]).text(types[t].charAt(0).toUpperCase() + types[t].substring(1) + " mines").prop("selected", types[t] == plugin.fieldType).appendTo(select);
			}
			select.on("change", function () {
				plugin.fieldType = $(this).val();
				vgap.map.draw();
			});

			//keep interaction with the tool from reaching the starmap and the NU hotkeys
			tool.on("mousedown mousemove click touchstart touchmove keydown", function (e) { e.stopPropagation(); });

			tool.appendTo("#MapControls");
			var button = $(".minelayermenu").first();
			if (button.length)
				tool.css("top", button.position().top + "px");
		},

		/**
		 * Work out which grid squares let a ship lay a new field that overlaps one of your fields, as row spans.
		 * Same rule as the client's mine laying prediction: the mines join your closest field (by centre, first
		 * in list order on a tie) of the same type, unless the ship is outside that field.
		 * @return      {minY, maxY, rows: {y: [[x0, x1], ...]}}
		 */
		getLayeringSpans: function () {
			var cache = this.spanCache;
			if (cache && cache.minefields === vgap.minefields && cache.count == vgap.minefields.length && cache.fieldType == this.fieldType && cache.playerId == vgap.player.id)
				return cache;

			var fields = [];
			var maxRadius = 0;
			for (var i = 0; i < vgap.minefields.length; i++) {
				var mf = vgap.minefields[i];
				if (mf.ownerid == vgap.player.id && this.getFieldType(mf) == this.fieldType) {
					fields.push(mf);
					maxRadius = Math.max(maxRadius, mf.radius);
				}
			}

			var rows = {};
			var minY = Infinity;
			var maxY = -Infinity;
			for (var i = 0; i < fields.length; i++) {
				minY = Math.min(minY, Math.ceil(fields[i].y - fields[i].radius));
				maxY = Math.max(maxY, Math.floor(fields[i].y + fields[i].radius));
			}

			for (var y = minY; y <= maxY; y++) {
				//x ranges of this row that lie inside one of your fields, merged
				var ranges = [];
				//the closest centre to a point inside a field is at most maxRadius away
				var candidates = [];
				for (var i = 0; i < fields.length; i++) {
					var dy = Math.abs(fields[i].y - y);
					if (dy <= fields[i].radius) {
						var half = Math.sqrt(fields[i].radius * fields[i].radius - dy * dy);
						ranges.push([Math.ceil(fields[i].x - half), Math.floor(fields[i].x + half)]);
					}
					if (dy <= maxRadius)
						candidates.push(fields[i]);
				}
				if (ranges.length == 0)
					continue;
				ranges.sort(function (a, b) { return a[0] - b[0]; });

				var spans = [];
				var lastX = -Infinity;
				for (var r = 0; r < ranges.length; r++) {
					for (var x = Math.max(ranges[r][0], lastX + 1); x <= ranges[r][1]; x++) {
						var closest = null;
						var closestDist = 10000.0;
						for (var c = 0; c < candidates.length; c++) {
							var dist = Math.dist(x, y, candidates[c].x, candidates[c].y);
							if (dist < closestDist) {
								closest = candidates[c];
								closestDist = dist;
							}
						}
						if (closest && closestDist > closest.radius) {
							var last = spans[spans.length - 1];
							if (last && last[1] == x - 1)
								last[1] = x;
							else
								spans.push([x, x]);
						}
					}
					lastX = Math.max(lastX, ranges[r][1]);
				}
				if (spans.length > 0)
					rows[y] = spans;
			}

			this.spanCache = { minefields: vgap.minefields, count: vgap.minefields.length, fieldType: this.fieldType, playerId: vgap.player.id, minY: minY, maxY: maxY, rows: rows };
			return this.spanCache;
		},

		/**
		 * Fill every grid square where a ship can lay a new field inside one of your fields
		 */
		drawLayeringRegions: function () {
			var map = vgap.map;
			var ctx = map.ctx;
			var cache = this.getLayeringSpans();

			var canvas = map.canvas;
			var fromY = Math.max(cache.minY, Math.floor(canvas.y) - 1);
			var toY = Math.min(cache.maxY, Math.ceil(canvas.y + canvas.mapheight) + 1);
			var fromX = Math.floor(canvas.x) - 1;
			var toX = Math.ceil(canvas.x + canvas.mapwidth) + 1;

			//one path for all squares so fractional squares when zoomed out do not stack their transparency
			ctx.save();
			ctx.fillStyle = this.fillColor;
			ctx.beginPath();
			for (var y = fromY; y <= toY; y++) {
				var spans = cache.rows[y];
				if (!spans)
					continue;
				for (var s = 0; s < spans.length; s++) {
					if (spans[s][1] < fromX || spans[s][0] > toX)
						continue;
					ctx.rect(map.screenX(spans[s][0] - 0.5), map.screenY(y + 0.5), (spans[s][1] - spans[s][0] + 1) * map.zoom, map.zoom);
				}
			}
			ctx.fill();
			ctx.restore();
		}

	}; //end mineLayeringPlugin

	// register your plugin with NU
	vgap.registerPlugin(mineLayeringPlugin, "mineLayeringPlugin");


	vgap.plugins["mineLayeringPlugin"].oldDrawMinefield = vgapMap.prototype.drawMinefield;

	/**
	 * Overload drawMinefield so minefields can be hidden from the starmap.
	 */
	vgapMap.prototype.drawMinefield = function () {
		var plugin = vgap.plugins["mineLayeringPlugin"];
		if (plugin.hideMinefields)
			return;

		//execute the normal drawMinefield function
		plugin.oldDrawMinefield.apply(this, arguments);
	};


	vgap.plugins["mineLayeringPlugin"].oldClearTools = vgapMap.prototype.clearTools;

	vgapMap.prototype.clearTools = function (result) {
		//the Clear (x) map tool also switches the overlay off
		var plugin = vgap.plugins["mineLayeringPlugin"];
		plugin.active = false;
		$(".minelayermenu").removeClass("minelayeractive");
		$("#MineLayerTool").remove();

		//execute the normal clearTools function
		plugin.oldClearTools.apply(this, arguments);
	};

} //wrapper for injection

var script = document.createElement("script");
script.type = "application/javascript";
script.textContent = "(" + wrapper + ")();";

document.body.appendChild(script);
document.body.removeChild(script);
