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
is closer than A's centre and the point is outside B. The hatched region is every such point: inside at least
one of your fields, but outside the field whose centre is nearest.

Change log:
1.0    Initial release [2026-10-18]
*/
function wrapper() { // wrapper for injection

	if (vgap.version < 3.0) {
		console.log("MineLayering plugin requires at least NU version 3.0. Plugin disabled.");
		return;
	}

	var plugin_version = 1.0;

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
				return;
			}

			vgap.map.addMapTool("Minefield Layering", "minelayermenu", function () { plugin.toggleOverlay(); });

			var head = document.getElementsByTagName('head')[0];
			if (head) {
				var newCss = document.createElement('style');
				newCss.type = "text/css";
				newCss.innerHTML = ".minelayermenu::before { content: \"\\f192\"; color: #FFFFFF }";
				newCss.innerHTML += ".minelayermenu.minelayeractive::before { color: #FFFF00 }";
				newCss.innerHTML += ".minelayermenu.minelayeractive { box-shadow: inset 0 0 0 2px #FFFF00 }";
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
		fieldType: "normal",	//which of your field types to layer: normal, web or hidden
		hatchColor: "rgba(255,255,0,0.75)",
		edgeColor: "rgba(255,255,0,0.9)",
		hatchSpacing: 8,	//screen pixels between hatch lines
		hatchPattern: null,

		/***************************************************************************************
		 * Custom plugin methods
		 ***************************************************************************************/

		toggleOverlay: function () {
			this.setActive(!this.active);
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
		 * Yellow cross hatch pattern, created once
		 */
		getHatchPattern: function (ctx) {
			if (!this.hatchPattern) {
				var size = this.hatchSpacing;
				var tile = document.createElement("canvas");
				tile.width = size;
				tile.height = size;
				var tctx = tile.getContext("2d");
				tctx.strokeStyle = this.hatchColor;
				tctx.lineWidth = 1;
				tctx.beginPath();
				//both diagonals, extended past the tile so the lines join up seamlessly when repeated
				tctx.moveTo(-1, -1);
				tctx.lineTo(size + 1, size + 1);
				tctx.moveTo(size + 1, -1);
				tctx.lineTo(-1, size + 1);
				tctx.stroke();
				this.hatchPattern = ctx.createPattern(tile, "repeat");
			}
			return this.hatchPattern;
		},

		/**
		 * Cross hatch every point inside one of your fields where laying mines creates a new field.
		 * For each field B the points whose nearest field centre is B (B's Voronoi cell) join B when inside it,
		 * so the layering region of B is: B's cell, outside B, inside some other field.
		 */
		drawLayeringRegions: function () {
			var map = vgap.map;
			var ctx = map.ctx;

			var fields = [];
			var maxRadius = 0;
			for (var i = 0; i < vgap.minefields.length; i++) {
				var mf = vgap.minefields[i];
				if (mf.ownerid == vgap.player.id && this.getFieldType(mf) == this.fieldType) {
					fields.push({ x: mf.x, y: mf.y, radius: mf.radius, sx: map.screenX(mf.x), sy: map.screenY(mf.y), srad: mf.radius * map.zoom });
					maxRadius = Math.max(maxRadius, mf.radius);
				}
			}
			if (fields.length < 2)
				return;

			//generous screen rect used to build half-plane and "everything except this circle" clip paths
			var w = ctx.canvas.width;
			var h = ctx.canvas.height;
			var big = Math.max(w, h) * 4;
			var pattern = this.getHatchPattern(ctx);

			for (var b = 0; b < fields.length; b++) {
				var fb = fields[b];
				//a hatched point is inside some field A and no further from B than from A, so within maxRadius of B
				if (!map.isVisible(fb.x, fb.y, maxRadius))
					continue;

				//fields close enough to B to overlap B's cell or bound it
				var near = [];
				for (var c = 0; c < fields.length; c++) {
					if (c != b && Math.dist(fb.x, fb.y, fields[c].x, fields[c].y) < fb.radius + maxRadius + maxRadius)
						near.push(fields[c]);
				}
				if (near.length == 0)
					continue;

				ctx.save();

				//inside at least one other field
				ctx.beginPath();
				for (var n = 0; n < near.length; n++) {
					ctx.moveTo(near[n].sx + near[n].srad, near[n].sy);
					ctx.arc(near[n].sx, near[n].sy, near[n].srad, 0, Math.PI * 2, false);
				}
				ctx.clip();

				//outside B: the mines would join B
				ctx.beginPath();
				ctx.rect(-big, -big, big * 2 + w, big * 2 + h);
				ctx.moveTo(fb.sx + fb.srad, fb.sy);
				ctx.arc(fb.sx, fb.sy, fb.srad, 0, Math.PI * 2, true);
				ctx.clip();

				//B's centre is the nearest: the half-plane on B's side of the bisector with each nearby field
				for (var n = 0; n < near.length; n++) {
					var dx = near[n].sx - fb.sx;
					var dy = near[n].sy - fb.sy;
					var len = Math.sqrt(dx * dx + dy * dy);
					if (len == 0)
						continue;
					var nx = dx / len;
					var ny = dy / len;
					var mx = (fb.sx + near[n].sx) / 2;
					var my = (fb.sy + near[n].sy) / 2;
					ctx.beginPath();
					ctx.moveTo(mx - ny * big, my + nx * big);
					ctx.lineTo(mx + ny * big, my - nx * big);
					ctx.lineTo(mx + ny * big - nx * big, my - nx * big - ny * big);
					ctx.lineTo(mx - ny * big - nx * big, my + nx * big - ny * big);
					ctx.closePath();
					ctx.clip();
				}

				ctx.fillStyle = pattern;
				ctx.fillRect(-big, -big, big * 2 + w, big * 2 + h);

				//outline the region; the clip keeps only the circle edges that border it
				ctx.strokeStyle = this.edgeColor;
				ctx.lineWidth = 2;
				ctx.beginPath();
				ctx.moveTo(fb.sx + fb.srad, fb.sy);
				ctx.arc(fb.sx, fb.sy, fb.srad, 0, Math.PI * 2, false);
				for (var n = 0; n < near.length; n++) {
					ctx.moveTo(near[n].sx + near[n].srad, near[n].sy);
					ctx.arc(near[n].sx, near[n].sy, near[n].srad, 0, Math.PI * 2, false);
				}
				ctx.stroke();

				ctx.restore();
			}
		}

	}; //end mineLayeringPlugin

	// register your plugin with NU
	vgap.registerPlugin(mineLayeringPlugin, "mineLayeringPlugin");


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
