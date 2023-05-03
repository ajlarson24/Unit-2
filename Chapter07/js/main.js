//declare map variable globally so all functions have access
var map;
var minValue;
var dataStats = {};

//step 1 create map
function createMap() {

    //create the map
    map = L.map('map', {
        center: [39.8282, -98.5795],
        zoom: 4
    });

    //add OSM base tilelayer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    //call getData function
    getData(map);
};

function calcStats(data){
    //create empty array to store all data values
    var allValues = [];
    //loop through each city
    for(var park of data.features){
        //loop through each year
        for(var year = 2015; year <= 2021; year+=1){
              //get population for current year
              var value = park.properties["Visitors_"+ String(year)];
              //add value to array
              allValues.push(value);
        }
    }
    //get min, max, mean stats for our array
    dataStats.min = Math.min(...allValues);
    dataStats.max = Math.max(...allValues);
    //calculate meanValue
    var sum = allValues.reduce(function(a, b){
        return a+b;
    });
    dataStats.mean = sum/ allValues.length;
}  

//calculate the radius of each proportional symbol
function calcPropRadius(attValue) {
    //constant factor adjusts symbol sizes evenly
    var minRadius = 5;
    //Flannery Apperance Compensation formula
    var radius = 1.0083 * Math.pow(attValue / dataStats.min, 0.8) * minRadius
    return radius;
};

//Example 2.1 line 1...function to convert markers to circle markers
function pointToLayer(feature, latlng, attributes) {
    //Step 4: Assign the current attribute based on the first index of the attributes array
    var attribute = attributes[0];

    //create marker options
    var options = {
        fillColor: "#56903a",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    };

    //For each feature, determine its value for the selected attribute
    var attValue = Number(feature.properties[attribute]);

    //Give each feature's circle marker a radius based on its attribute value
    options.radius = calcPropRadius(attValue);

    //create circle marker layer
    var layer = L.circleMarker(latlng, options);

    //build popup content string starting with city...Example 2.1 line 24
    var popupContent = "<p><b>Park:</b> " + feature.properties.Park + "</p>";

    //add formatted attribute to popup content string
    var year = attribute.split("_")[1];
    popupContent += 
        "<p><b>Visitors in " + 
        year + ":</b> " + 
        feature.properties[attribute] + 
        " million</p>";

    //bind the popup to the circle marker
    layer.bindPopup(popupContent, {
        offset: new L.Point(0, -options.radius)
    });

    //return the circle marker to the L.geoJson pointToLayer option
    return layer;
};

//Add circle markers for point features to the map
function createPropSymbols(data, attributes) {
    //create a Leaflet GeoJSON layer and add it to the map
    L.geoJson(data, {
        pointToLayer: function (feature, latlng) {
            return pointToLayer(feature, latlng, attributes);
        }
    }).addTo(map);
};

//Step 10: Resize proportional symbols according to new attribute values
function updatePropSymbols(attribute) {
    var year = attribute.split("_")[1];
    //update temporal legend
    document.querySelector("span.year").innerHTML = year;

    map.eachLayer(function (layer) {
        //Example 3.18 line 4
        if (layer.feature && layer.feature.properties[attribute]) {
            //access feature properties
            var props = layer.feature.properties;

            //update each feature's radius based on new attribute values
            var radius = calcPropRadius(props[attribute]);
            layer.setRadius(radius);

            //add city to popup content string
            var popupContent = "<p><b>Park:</b> " + props.Park + "</p>";

            //add formatted attribute to panel content string
            var year = attribute.split("_")[1];
            popupContent += "<p><b>Visitors in " + year + ":</b> " + props[attribute] + " million</p>";

            //update popup content            
            popup = layer.getPopup();
            popup.setContent(popupContent).update();
        }
    });

    updateLegend(attribute);
};

//Above Example 3.10...Step 3: build an attributes array from the data
function processData(data) {
    //empty array to hold attributes
    var attributes = [];

    //properties of the first feature in the dataset
    var properties = data.features[0].properties;

    //push each attribute name into attributes array
    for (var attribute in properties) {
        //only take attributes with population values
        if (attribute.indexOf("Visitors") > -1) {
            attributes.push(attribute);
        };
    };
    return attributes;
};

//Create new sequence controls
function createSequenceControls(attributes){       
  var SequenceControl = L.Control.extend({
      options: {
          position: 'bottomleft'
      },

      onAdd: function () {
          // create the control container div with a particular class name
          var container = L.DomUtil.create('div', 'sequence-control-container');

          //create range input element (slider)
          container.insertAdjacentHTML('beforeend', '<input class="range-slider" type="range">')

          //add skip buttons
          container.insertAdjacentHTML('beforeend', '<button class="step" id="reverse" title="Reverse"><img src="img/reverse.png"></button>'); 
          container.insertAdjacentHTML('beforeend', '<button class="step" id="forward" title="Forward"><img src="img/forward.png"></button>'); 

          //disable any mouse event listeners for the container
          L.DomEvent.disableClickPropagation(container);


          return container;

      }
  });

  map.addControl(new SequenceControl());

  ///////add listeners after adding the control!///////
  //set slider attributes
  document.querySelector(".range-slider").max = 6;
  document.querySelector(".range-slider").min = 0;
  document.querySelector(".range-slider").value = 0;
  document.querySelector(".range-slider").step = 1;

  var steps = document.querySelectorAll('.step');

  steps.forEach(function(step){
      step.addEventListener("click", function(){
          var index = document.querySelector('.range-slider').value;
          //Step 6: increment or decrement depending on button clicked
          if (step.id == 'forward'){
              index++;
              //Step 7: if past the last attribute, wrap around to first attribute
              index = index > 6 ? 0 : index;
          } else if (step.id == 'reverse'){
              index--;
              //Step 7: if past the first attribute, wrap around to last attribute
              index = index < 0 ? 6 : index;
          };

          //Step 8: update slider
          document.querySelector('.range-slider').value = index;

          //Step 9: pass new attribute to update symbols
          updatePropSymbols(attributes[index]);
      })
  })

  //Step 5: input listener for slider
  document.querySelector('.range-slider').addEventListener('input', function(){
      //Step 6: get the new index value
      var index = this.value;

      //Step 9: pass new attribute to update symbols
      updatePropSymbols(attributes[index]);
  });

};

//Example 2.7 line 1...function to create the legend
function createLegend(attributes){
    var LegendControl = L.Control.extend({
        options: {
            position: 'bottomright'
        },

        onAdd: function () {
            // create the control container with a particular class name
            var container = L.DomUtil.create('div', 'legend-control-container');

            container.innerHTML = '<p class="temporalLegend">Visitors in <span class="year">2015</span></p>';

                    //Example 3.5 line 15...Step 1: start attribute legend svg string
            var svg = '<svg id="attribute-legend" width="250px" height="160px">';

            //array of circle names to base loop on  
            var circles = ["max", "mean", "min"]; 

            //Example 3.8 line 4...loop to add each circle and text to SVG string
            for (var i=0; i<circles.length; i++){

                //Step 3: assign the r and cy attributes            
                var radius = calcPropRadius(dataStats[circles[i]]);           
                var cy = 90 - radius;            

            //circle string            
                svg += 
                    '<circle class="legend-circle" id="' + circles[i] + '" r="' + radius + 
                    '"cy="' + cy + '" fill="#56903a" fill-opacity="0.8" stroke="#000000" cx="55"/>';

                //evenly space out labels            
                var textY = i * 25 + 25;            

                //text string            
                svg += 
                    '<text id="' + circles[i] + '-text" x="120" y="' + textY + '">' + 
                    Math.round(dataStats[circles[i]]*100)/100 + " million" + '</text>';
            };

        //close svg string
        svg += "</svg>";

        //add attribute legend svg to container
        container.insertAdjacentHTML('beforeend',svg);

        return container;
        },
    });

    map.addControl(new LegendControl());
};

function getData(map) {
    //load the data
    fetch("data/Parks.geojson")
        .then(function (response) {
            return response.json();
        })
        .then(function (json) {
            var attributes = processData(json);
            calcStats(json)
            createPropSymbols(json, attributes);
            createSequenceControls(attributes);
            createLegend(attributes);
        })
};

document.addEventListener('DOMContentLoaded', createMap)
//ADDED TO REUPLOAD TO GITHUB