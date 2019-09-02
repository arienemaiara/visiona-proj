var map = new L.Map('map', {
	center: new L.LatLng(-14.885, -58.359),
	zoom: 5,
	zoomControl: true
});

map.zoomControl.setPosition('topright');

L.control.coordinates({
	position: 'bottomright',
	decimals: 2,
	decimalSeperator: '.',
	labelTemplateLat: 'Latitude: {y}',
	labelTemplateLng: 'Longitude: {x}',
	useLatLngOrder: true,
	enableUserInput: false
}).addTo(map);

L.control.scale({
	position: 'bottomright',
}).addTo(map);

var basemaps = [
	L.tileLayer('http://{s}.tiles.wmflabs.org/bw-mapnik/{z}/{x}/{y}.png', {
		attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
		maxZoom: 18,
		minZoom: 0,
		label: 'open street map - black and white'
	})
];

map.addControl(L.control.basemaps({
	basemaps: basemaps,
	tileX: 0, 
	tileY: 0, 
	tileZ: 1
}));

var slider = document.getElementById('slider-cloud');
noUiSlider.create(slider, {
	start: 20,
	connect: [true, false],
	step: 1,
	tooltips: [wNumb({
		decimals: 0,
		suffix: '%'
	})],
	range: {
		'min': 0,
		'max': 100
	},
	format: wNumb({
		decimals: 0
	})
});

var startDate = '';
var endDate = '';
var filters;
var satelliteSelector;
var cloud;
var scope = {};
var areaProjeto = '';
var table_dataTables;
var drawnItems = L.featureGroup().addTo(map);
var drawObj;

var drag = {
	area: null,
	graphic: null
};

$('#draw-rectangle').click(function () {
	if (map.hasLayer(drawnItems)) {
		drawnItems.eachLayer(
			function (l) {
				drawnItems.removeLayer(l);
			}
		);
	}
	if (drag.graphic) {
		if (drawObj) {
			drawObj.disable();
		}
		$('.snackbar').remove();
	}
	drag.graphic = new L.Control.Draw();
	drawObj = new L.Draw.Rectangle(map, drag.graphic.options.rectangle);
	drawObj.enable();
	$('.sidebar').removeClass('show-sidebar')
});

$('#draw-polygon').click(function () {
	if (map.hasLayer(drawnItems)) {
		drawnItems.eachLayer(
			function (l) {
				drawnItems.removeLayer(l);
			}
		);
	}
	if (drag.graphic) {
		if (drawObj) {
			drawObj.disable();
		}
		$('.snackbar').remove();
	}
	drag.graphic = new L.Control.Draw();
	drawObj = new L.Draw.Polygon(map, drag.graphic.options.polygon);
	drawObj.enable();
	$('.sidebar').removeClass('show-sidebar')
});

map.on(L.Draw.Event.CREATED, function (event) {
	var layer = event.layer;
	var lyrType = getLyrType(layer);

	overlayLayerGroup.remove()
	overlayLayerGroup = new L.LayerGroup;
	overlayLayerGroup.addTo(map);

	if (lyrType === "polygon" || lyrType === "rectangle") {
		var geoJSON = layer.toGeoJSON();
		
		if (validateArea(geoJSON)) {
			aoiGeoJSON = JSON.stringify(geoJSON);
			drawnItems.addLayer(layer);
			map.fitBounds(layer.getBounds());
			search()
		}
	}
});

function getLyrType(layer) {
	if (layer instanceof L.Circle) {
		return 'circle';
	}
	if (layer instanceof L.Marker) {
		return 'marker';
	}
	if ((layer instanceof L.Polyline) && !(layer instanceof L.Polygon)) {
		return 'polyline';
	}
	if ((layer instanceof L.Polygon) && !(layer instanceof L.Rectangle)) {
		return 'polygon';
	}
	if (layer instanceof L.Rectangle) {
		return 'rectangle';
	}
};

function validateArea(geoJSON) {
	drag.area = turf.area(geoJSON);

	if ((drag.area / Math.pow(10, 6)) > 15000) {
		$('.area-modal').css('display', 'block');
		alert('Area of interest must be less than 15.000 km².')
		return false;
	} else {
		var formatArea = L.GeometryUtil.readableArea(drag.area, "km", "0");

		if (areaProjeto != '') {
			if (turf.booleanContains(areaProjeto, geoJSON)) {
				$.snackbar({
					content: 'Area: ' + formatArea,
					timeout: 0
				});
				return true;
			} else {
				$('.project-area-modal').css('display', 'block');
				return false
			}
		} else {
			$.snackbar({
				content: 'Area: ' + formatArea,
				timeout: 0
			});
			return true;
		}
	}
};

async function search(filter=false) {

	$('body').loading({
		stoppable: true
	});

	$('#no_data').html('');
	var api_arr = [];
	var sentinel = $("input[name='sentinel']:checked").is(':checked');
	var landsat = $("input[name='landsat']:checked").is(':checked');
	if ( $.fn.DataTable.isDataTable( '#table' ) ) {
		$('#table').DataTable().destroy()
		$('#table').html('')
	}
	if(filter == true){
		overlayLayerGroup.remove()
		overlayLayerGroup = new L.LayerGroup;
		overlayLayerGroup.addTo(map);
	}
	if (startDate == '' || endDate == '') {
		startDate = moment().subtract(1, 'months').format('YYYY-MM-DD');
		endDate = moment().format('YYYY-MM-DD');
	}
	cloud = slider.noUiSlider.get();
	if(sentinel){
		sent_arr = await search_api_sent();
	}else sent_arr.features = []
	if(landsat){
		land_arr = await search_api_land();
	}else land_arr.features = []

	api_arr = api_arr.concat(sent_arr.features).concat(land_arr.features)
	buildQueryAndRequest(api_arr);

};

async function search_api_sent(){
	var data = JSON.stringify({
		"time": startDate + '/' + endDate,
		"intersects": aoiGeoJSON,
		"query": {
			"eo:cloud_cover": {
				"lte": cloud
			},
			"collection": { 
				"eq": "sentinel-2-l1c" 
			}
		},
		"sort": [
			{
				"field": "datetime",
				"direction": "desc"
			}
		],
		"limit": 1000
	});

	return fetch('http://localhost:4000/api/search',{
		method: 'POST',
		mode: "cors", 
		cache: "no-cache",
		headers: {
			"Content-Type": "application/json",
		},
		body: data
	}).then(response => response.json())
}

async function search_api_land(){
	var data = JSON.stringify({
		"time": startDate + '/' + endDate,
		"intersects": aoiGeoJSON,
		"query": {
			"eo:cloud_cover": {
				"lte": cloud
			},
			"collection": { 
				"eq": "landsat-8-l1" 
			}
		},
		"sort": [
			{
				"field": "datetime",
				"direction": "desc"
			}
		],
		"limit": 1000
	});

	return fetch('http://localhost:4000/api/search',{
		method: 'POST',
		mode: "cors", 
		cache: "no-cache",
		headers: {
			"Content-Type": "application/json",
		},
		body: data
	}).then(response => response.json())	
}

function buildQueryAndRequest(features) {
	let flag = null;
	scope.results = {};
	if (features.length > 0) {
		Promise.all(features.map(e => {
				return e;
			}))
			.then(res => {
				for (let i = 0; i < res.length; i += 1) {
					let data = res[i];
					let scene = {};
					
					if(!data.geometry_name) {
						scene.platformName = data.properties['eo:platform'];
						scene.date = moment(data.properties.datetime).format('YYYY-MM-DD');
						scene.cloud = data.properties['eo:cloud_cover'];
						scene.off_nadir = data.properties['eo:off_nadir'];
						scene.thumbnail = data.assets.thumbnail.href;
						scene.footprint = data.geometry;
						scene.footprintWkt = getWKT(scene.footprint);
					}
					if (scene.platformName === 'landsat-8') {
						scene.scene_id = data.properties['landsat:product_id'];
						scene.path = zeroPad(data.properties['eo:column'], 3);
						scene.row = zeroPad(data.properties['eo:row'], 3);
						scene.grid = `${scene.path}/${scene.row}`;
						scene.downloadUrl = `https://landsatonaws.com/L8/${scene.path}/${scene.row}/${scene.scene_id}`;

					} else if (scene.platformName === 'sentinel-2a' || scene.platformName === 'sentinel-2b' ) {
						scene.scene_id = data.properties['sentinel:product_id'];
						scene.utm_zone = data.properties['sentinel:utm_zone'];
						scene.latitude_band = data.properties['sentinel:latitude_band'];
						scene.grid_square = data.properties['sentinel:grid_square'];
						scene.grid = `${scene.utm_zone}${scene.latitude_band}${scene.grid_square}`;

						getProductInfo(scene.scene_id, scene.date)
							.then(productInfoId => {
								scene.downloadUrl = "https://scihub.copernicus.eu/dhus/odata/v1/Products('" + productInfoId + "')/$value";
							});
					}

					let grid_scenes = [];
					grid_scenes.push(scene);
					scope.results[grid_scenes[0].scene_id] = grid_scenes;
				}
				const sceneID = Object.keys(scope.results);
				return sceneID.map(e => {
					let latest = scope.results[e][0];
					var htm = '';
					htm +=			`<tr data-scene="${latest.scene_id}" footprint="${latest.footprintWkt}" data-grid=${latest.grid} sat=${latest.platformName} img-date="${latest.date}" onmouseover="highlightFootprint(this)" onmouseout="resetHighlight(this)" data-srcset="${latest.thumbnail}">`
					htm +=				`<td> <input class="mx-auto d-block footprint_selected img_selected" thumb-url="${latest.thumbnail}" type="checkbox"> </td>`
					htm +=				`<td> ${latest.platformName} </td>`
					htm +=				`<td> ${latest.date} </td>`
					htm +=				`<td> ${latest.cloud} </td>`
					htm +=				`<td>`
					htm +=					`<img class="mx-auto d-block img_info" src="/img/info.png" width="16px" style="cursor: pointer" onclick="toggle_info('${latest.scene_id}')">`
					htm +=				`</td>`
					htm +=			`</tr>`
					return htm;
				})
			})
			.catch(err => {
				console.warn(err);
				$('.mount-table').append('<span class="nodata-error middle-center txt-l">No image found</span>');
			})
			.then ( async data => {

				var table = '';
				table += `<thead>`
				table +=		`<tr>`
				table +=			`<th></th>`
				table +=			`<th>Satellite</th>`
				table += 			`<th>Date</th>`
				table += 			`<th>Cloud</th>`
				table +=			`<th></th>`
				table +=		`</tr>`
				table +=	`</thead>`
				table +=	`<tbody>`
				table += data
				table += `</tbody>`

				try {
					flag = await $('#table').append(table);
				} catch (error) {
					console.log(error)
				}
				
				if(flag != null) {
					table_dataTables = $('#table').DataTable({
						scrollY: '50vh',
						scrollCollapse: true,
						paging: false,
						"retrieve": true,
						"autoWidth": false,
						"aoColumnDefs": [
							{ 
								"sClass": "my_class", 
								"aTargets": [ 4 ]
							}
						]
					});

					$('.footprint_selected').change(function(){
						createThumbnailLayer(this)
					})
				}
				// loading stop
				$('body').loading('stop');

				// $('.icon-bottom').css('margin-top', '380px');
				$('.step-2').css('display', 'block');
				show_catalog()
			});
		addFootprintLayerGroup();
	} else {
		show_catalog()
		$('#no_data').html('<center><span> No image found </span></center>')
		$('body').loading('stop');
	}
};

var footLayerGroup = new L.LayerGroup;

const addFootprintLayerGroup = () => {
	footLayerGroup.addTo(map);
};

function getWKT(geoJSON) {
	var wkt = new Wkt.Wkt();
	wkt.read(JSON.stringify(geoJSON));
	return (wkt.write());
};

async function getProductInfo(sceneId, sceneDate) {

	var data1 = sceneDate.split('-')[0];
	var data2 = sceneDate.split('-')[1];
	data2 = data2.replace(/\b0+/g, ''); 
	var data3 = sceneDate.substring(8, 10);
	data3 = data3.replace(/\b0+/g, '');

	var endPoint = `https://roda.sentinel-hub.com/sentinel-s2-l1c/products/${data1}/${data2}/${data3}/${sceneId}/productInfo.json`;

	var productInfo = await $.get(endPoint);
	var productInfoId = productInfo.id;
	return productInfoId;
}

const zeroPad = (n, c) => {
	let s = String(n);
	if (s.length < c) s = zeroPad('0' + n, c);
	return s;
}

const resetHighlight = (e) => {
	map.removeLayer(objWKT);
};

const highlightFootprint = (e) => {

	var footprint = e.getAttribute('footprint');

	// utilização de wicket para desenho de wkt
	var wkt = new Wkt.Wkt();
	wkt.read(footprint);
	objWKT = wkt.toObject(map.defaults);

	// style para polígono do footprint (cor cyan)
	objWKT.setStyle({
		weight: 0.1,
		color: '#00FFFF',
		fillOpacity: 0.3
	});

	objWKT.addTo(map);

};

function zoomToPreview(e) {
	map.fitBounds(objWKT.getBounds());
	createThumbnailLayer(e);
}

var overlayLayerGroup = new L.LayerGroup;
overlayLayerGroup.addTo(map);

function createThumbnailLayer(e) {
	var url = e.getAttribute('thumb-url');
	var thumbnailBounds = objWKT.getBounds();
	
	var overlay = L.imageOverlay(
		url,
		thumbnailBounds, {
			opacity: 1
		}
	);
		
	if(!$(e).is(':checked')) {
		var allLayers = overlayLayerGroup.getLayers();
		foundId = allLayers.find((el) => {
			return el._url == url 
		})
		if( foundId ) {
			overlayLayerGroup.removeLayer(foundId._leaflet_id)
		}
	}
	else overlayLayerGroup.addLayer(overlay);
}

$('.filter_search').click(function(){
	search(filter=true)
})

async function img_info( id, flag=false ){
	let img_selected_info_return;
	let legacy_id = ''
	let sun_azi = '';
	let sun_ele = '';
	$('#sun_azi').html('')
	$('#sun_ele').html('')
	var current_img;
	if(scope.results.length != 0){
		var sceneID = Object.keys(scope.results);
		await sceneID.find(e => {
			let latest = scope.results[e][0];
			if(latest.scene_id == id && flag == false) {
				current_img = latest
				$('#id').html(current_img.scene_id)
				$('#sensor').html(current_img.platformName)
				$('#off-nadir').html(current_img.off_nadir)
				$('#cloud_cover').html(current_img.cloud)
				$('#ac_date').html(current_img.date)
				var img = '<a href="'+current_img.thumbnail+'" target="_blank"> <img class="mx-auto d-block" width="170px" height="170px" src="' + current_img.thumbnail + '"></a>'	
				$('#img_satellite').html(img)

			}else if(latest.scene_id == id && flag == true){
				img_selected_info_return = latest
			}
		})

		return img_selected_info_return;
	}else{
		console.log('scope.results: ', scope.results)
		alert('algo deu errado')
	}
}