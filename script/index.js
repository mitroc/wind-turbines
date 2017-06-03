/*
 Declare global map.
 */
let googleMap;

/*
 Google Maps with Poland. Add custom buttons.
 CAA/Arcgis api call for turbines' data and traverse the response.
 */
function initMap () {
  /* Load maps */
  googleMap = new google.maps.Map(document.querySelector("#map"), {
    center: {
      lat: 51.91,
      lng: 19.1
    },
    zoom: 7,
    mapTypeId: "terrain",
    scaleControl: true,
    rotateControl: true,
    gestureHandling: 'greedy',
    mapTypeControlOptions: {
      position: google.maps.ControlPosition.LEFT_TOP
    }
  });

  /* Add drawing manager to map. */
  const drawingManager = new google.maps.drawing.DrawingManager({
    drawingControlOptions: {
      position: google.maps.ControlPosition.TOP_CENTER,
      drawingModes: ['circle']
    },
    circleOptions: {
      strokeWeight: 1,
      clickable: false,
      editable: true,
    },
    polylineOptions: {

    }
  });
  drawingManager.setMap(googleMap);

  /* Get circle radius. */
  google.maps.event.addListener(drawingManager, 'circlecomplete', function(circle) {
    let radius = circle.getRadius();
    console.log(radius);

    google.maps.event.addListener(circle, 'radius_changed', function() {
      console.log(this.getRadius());
    });
  });

  /* Measure tool */
  const measureTool = new MeasureTool(googleMap ,{
    contextMenu: false
  });

  /* Add custom menu buttons. View type. */
  const menu = document.createElement("div");
  menu.className = "menu";

  const heatMapBtn = document.createElement("div");
  heatMapBtn.className = "btn btn--active";
  heatMapBtn.id = "toggle-heatmap";
  heatMapBtn.innerHTML = "Mapa ciepła";
  heatMapBtn.title = "Włącz/Wyłącz widok mapy ciepła.";
  menu.appendChild(heatMapBtn);

  const clusterBtn = document.createElement("div");
  clusterBtn.className = "btn";
  clusterBtn.id = "toggle-clusters";
  clusterBtn.innerHTML = "Klastry";
  clusterBtn.title = "Włącz/Wyłącz widok mapy klastrów.";
  menu.appendChild(clusterBtn);

  const turbinesBtn = document.createElement("div");
  turbinesBtn.className = "btn";
  turbinesBtn.id = "toggle-turbines";
  turbinesBtn.innerHTML = "Turbiny";
  turbinesBtn.title = "Włącz/Wyłącz widok pojedynczych turbin.";
  menu.appendChild(turbinesBtn);

  googleMap.controls[google.maps.ControlPosition.TOP_LEFT].push(
    menu
  );

  /* Add custom menu buttons. Measure tool. */
  const measure = document.createElement("div");
  measure.className = "measure";

  const drawMeasureBtn = document.createElement("div");
  drawMeasureBtn.className = "btn btn-measure";
  drawMeasureBtn.id = "measure-draw";
  drawMeasureBtn.innerHTML = "<img src='image/measure.png'>";
  drawMeasureBtn.title = "Zmierz odległość";
  measure.appendChild(drawMeasureBtn);

  googleMap.controls[google.maps.ControlPosition.LEFT_TOP].push(
    measure
  );

  drawMeasureBtn.addEventListener("click", function () {
    if (this.classList.contains("measure-clear")) {
      measureTool.end();
      drawMeasureBtn.innerHTML = "<img src='image/measure.png'>";
      drawMeasureBtn.title = "Zmierz odległość";
      this.classList.toggle("measure-clear");
    } else {
      measureTool.start();
      drawMeasureBtn.innerHTML = "<img src='image/clear.png'>";
      drawMeasureBtn.title = "Wyczyść pomiar";
      this.classList.toggle("measure-clear");
    }
  });

  /* Add custom info field. */
  const info = document.createElement("div");
  info.className = "info";

  googleMap.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(
    info
  );
 
  /* Add info modal */
  const modal = document.querySelector('#description');
  const close = document.getElementsByClassName('close')[0];
  close.addEventListener("click", function () {
    modal.classList.toggle("modal--hide");
  });

  /* Call for turbines' data */
  $.ajax({
    url: "https://services.arcgis.com/cqaIQEE6sk78TLdG/arcgis/rest/" +
    "services/ObstaclesDataServiceFME/FeatureServer/0/query?",
    dataType: "json",
    data: {
      f: "pgeojson",
      geometry: {
        xmin: 1400000,
        ymin: 6200000,
        xmax: 2800000,
        ymax: 7400000,
        spatialReference: {
          wkid: 102100
        }
      },
      geometryType: "esriGeometryEnvelope",
      inSR: 102100,
      outFields: "objectid,height_m,terrain_m,amsl_m,added",
      outSR: 4326,
      resultType: "tile",
      returnGeometry: true,
      spatialRel: "esriSpatialRelIntersects",
      where: "OBST_TYPE LIKE '%wind%'"
    }
  })
    .done(displayResults)
    .done(calculations)
    .fail(errorMessage);
}

/*
 CAA failure handling.
 */
function errorMessage (xhr, status) {
  console.log(
    `status: ${status}\nHTTP: ${xhr.status}\nJSON: ${xhr.responseJson}`
  );

  const errorHeader = document.createElement("h2");
  errorHeader.innerHTML = "Mamy jakieś problemy na łączach...";

  const errorParagraph = document.createElement("p");
  errorParagraph.innerHTML = "Spróbuj odświeżyć stronę.";

  const errorContainer = document.querySelector("#error");
  errorContainer.className = "message-error";
  errorContainer.appendChild(errorHeader);
  errorContainer.appendChild(errorParagraph);
}

/*
 Calculations on the data.
 */
function calculations (geojson) {
  const infoWindow = document.querySelector(".info");
  const numberOfTurbines = geojson.features.length;
  const heights = geojson.features.map(
    turbine => turbine.properties.HEIGHT_M
  );
  const maxHeight = Math.max(...heights);
  const minHeight = Math.min(...heights);
  const avgHeight = Math.round(
    heights.reduce(
      (prev, next) => prev + next
    ) / numberOfTurbines
  );

  infoWindow.innerHTML = `<table>
                <tr><td>Liczba turbin: </td><td><strong> ${numberOfTurbines}</strong></td></tr>
                <tr><td>Wysokość max: </td><td><strong> ${maxHeight} m</strong></td></tr>
                <tr><td>Wysokość min:</td><td><strong> ${minHeight} m</strong></td></tr>
                <tr><td>Wysokość średnia: </td><td><strong>${avgHeight} m</strong></td></tr>
              </table>`;
}

/*
 Heatmap, markers and clusters display handle.
 Menu buttons handle.
 */
function displayResults (geojson) {
  /*
   HEATMAP---------------------------------------------------------
   */
  const coordinates = geojson.features.map((turbine, i, arr) => ({
    location: new google.maps.LatLng(
      turbine.geometry.coordinates[1],
      turbine.geometry.coordinates[0]
    ),
    weight: Math.pow(1.05, turbine.properties.HEIGHT_M)
  }));

  const heatMap = new google.maps.visualization.HeatmapLayer({
    data: coordinates,
    map: googleMap,
    radius: 15,
    gradient: [
      "rgba(0, 255, 255, 0)",
      "rgba(0, 255, 255, 1)",
      "rgba(0, 191, 255, 1)",
      "rgba(0, 127, 255, 1)",
      "rgba(0, 63, 255, 1)",
      "rgba(0, 0, 255, 1)",
      "rgba(0, 0, 223, 1)",
      "rgba(0, 0, 191, 1)",
      "rgba(0, 0, 159, 1)",
      "rgba(0, 0, 127, 1)",
      "rgba(63, 0, 91, 1)",
      "rgba(127, 0, 63, 1)",
      "rgba(191, 0, 31, 1)",
      "rgba(255, 0, 0, 1)"
    ]
  });

  const heatMapBtn = document.querySelector("#toggle-heatmap");
  heatMapBtn.addEventListener("click", function () {
    heatMap.setMap(heatMap.getMap() ? null : googleMap);
    this.classList.toggle("btn--active");
  });

  /*
   MARKERS---------------------------------------------------------
   */
  let currentMap = null;
  let prevInfoWindow = false;

  const markers = geojson.features.map(turbine => {
    const marker = new google.maps.Marker({
      position: {
        lat: turbine.geometry.coordinates[1],
        lng: turbine.geometry.coordinates[0]
      },
      // icon: "https://maps.gstatic.com/mapfiles/ridefinder-images/mm_20_red.png",
      icon: "https://raw.githubusercontent.com/mitroc/wind-turbines/master/image/wind-turbine.png",
      title: `Tip height: ${turbine.properties.HEIGHT_M} m`
    });

    const infoWindow = new google.maps.InfoWindow({
      content: `<table>
                <tr><td>Wysokość:</td><td><strong><u> ${turbine.properties.HEIGHT_M} m</u></strong></td></tr>
                <tr><td>Wysokość n.p.m.:</td><td><strong> ${turbine.properties.AMSL_M} m</strong></td></tr>
                <tr><td>Teren n.p.m.:</td><td><strong> ${turbine.properties.TERRAIN_M} m</strong></td></tr>
                <tr><td>Współrzędne:</td><td> ${Math.round(turbine.geometry.coordinates[1] * 1000000) / 1000000}\xB0 N</td></tr>
                <tr><td></td><td> ${Math.round(turbine.geometry.coordinates[0] * 1000000) / 1000000}\xB0 E</td></tr>
                <tr><td>Dodano:</td><td> ${turbine.properties.ADDED}</td></tr>
              </table>`
    });

    marker.addListener("click", function () {
      if (prevInfoWindow) {
        prevInfoWindow.close();
      }
      prevInfoWindow = infoWindow;
      infoWindow.open(googleMap, this);
    });

    return marker;
  });

  function setMapForMarkers (map) {
    for (let i = 0; i < markers.length; i += 1) {
      markers[i].setMap(map);
    }
    currentMap = map;
  }

  const turbinesBtn = document.querySelector("#toggle-turbines");
  turbinesBtn.addEventListener("click", function () {
    currentMap === null
      ? setMapForMarkers(googleMap)
      : setMapForMarkers(null);
    this.classList.toggle("btn--active");
  });

  /*
   CLUSTERS---------------------------------------------------------
   */
  const markersForClusters = geojson.features.map(
    turbine =>
      new google.maps.Marker({
        position: {
          lat: turbine.geometry.coordinates[1],
          lng: turbine.geometry.coordinates[0]
        }
      })
  );

  const markerClusterer = new MarkerClusterer(null, markersForClusters, {
    imagePath: "https://cdn.rawgit.com/googlemaps/js-marker-clusterer/gh-pages/images/m",
    gridSize: 100,
    averageCenter: true,
    minimumClusterSize: 1
  });

  const clusterBtn = document.querySelector("#toggle-clusters");
  clusterBtn.addEventListener("click", function () {
    markerClusterer.setMap(markerClusterer.getMap() ? null : googleMap);
    for (let i = 0; i < markersForClusters.length; i += 1) {
      markersForClusters[i].setMap(null);
    }
    this.classList.toggle("btn--active");
  });
}
