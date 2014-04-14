var map;
var AQE = (function ( $ ) {
  "use strict";

  // set up icons for map
  var eggIcon = L.icon({
      iconUrl: '/assets/img/egg-icon.png',
      iconSize: [19, 20], // size of the icon
  });
  var aqsIcon = L.icon({
      iconUrl: '/assets/img/blue_dot.png',
      iconSize: [5, 5], // size of the icon
  });

  // Air Quality Egg and AirNow AWS layers
  var egg_layer = L.layerGroup([]);
  var egg_heatmap = L.heatLayer([], {radius: 25})
  var egg_heatmap_layer = L.layerGroup([egg_heatmap])
  var aqs_layer = L.layerGroup([]);
  var aqs_heatmap = L.heatLayer([], {radius: 25})
  var aqs_heatmap_layer = L.layerGroup([aqs_heatmap])

  // OpenWeatherMap Layers
  var clouds_layer = L.OWM.clouds({opacity: 0.8, legendImagePath: 'files/NT2.png'});
  var precipitation_layer = L.OWM.precipitation( {opacity: 0.5} );
  var rain_layer = L.OWM.rain({opacity: 0.5});
  var snow_layer = L.OWM.snow({opacity: 0.5});
  var pressure_layer = L.OWM.pressure({opacity: 0.4});
  var temp_layer = L.OWM.temperature({opacity: 0.5});
  var wind_layer = L.OWM.wind({opacity: 0.5});

  var groupedOverlays = {
    "Air Quality Eggs": {
      "Markers": egg_layer,
      "Heatmap": egg_heatmap_layer
    },
    "AirNow AQS Sites": {
      "Markers": aqs_layer,
      "Heatmap": aqs_heatmap_layer
    },
    "OpenWeatherMap": {
      "Clouds": clouds_layer,
      "Precipiration": precipitation_layer,
      "Rain": rain_layer,
      "Snow": snow_layer,
      "Pressure": pressure_layer,
      "Temperature": temp_layer,
      "Wind": wind_layer
    }
  };

  xively.setKey( "1bgDuzNfCI94eDrcSN0DJ2Kho7zGmXRsCwGTYTA1ugVuLqDa" ); // (READ ONLY) TODO refactor

  initialize()

  function initialize() {
    // load feeds and then initialize map and add the markers
    if(local_feed_path){
      // set up leaflet map
      map = L.map('map_canvas', {scrollWheelZoom: false, layers: [egg_layer, aqs_layer]})
      handleNoGeolocation();
      L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
          maxZoom: 18
      }).addTo(map);
      L.control.groupedLayers([], groupedOverlays).addTo(map);
      L.control.locate({locateOptions: {maxZoom: 9}}).addTo(map);

      $.getJSON(local_feed_path, function(mapmarkers){
        // if on an egg's page, zoom in close to the egg
        if ( $(".dashboard-map").length && mapmarkers && mapmarkers.length ) {
          map.setView([mapmarkers[0].location_lat,mapmarkers[0].location_lon],9)
        }

        // add eggs to map
        for ( var x = 0, len = mapmarkers.length; x < len; x++ ) {
          addEggMapMarker(mapmarkers[x]);
        }

        $("span#num_eggs").html(mapmarkers.length)
      })
    }

    //  - load active AQS stations to map
    $.getJSON("/all_aqs_sites.json", function(aqs_mapmarkers){
      for ( var x = 0, len = aqs_mapmarkers.length; x < len; x++ ) {
        addAQSSiteMapMarker( aqs_mapmarkers[x] );
      }
    })

    map.on('overlayadd', function (eventLayer) {
      if(eventLayer.name == "Heatmap" && eventLayer.group.name == "Air Quality Eggs"){
        egg_heatmap.setLatLngs(egg_layer.getLayers().map(function(l){return [l.getLatLng().lat, l.getLatLng().lng, "1"]}))
      }
      if(eventLayer.name == "Heatmap" && eventLayer.group.name == "AirNow AQS Sites"){
        aqs_heatmap.setLatLngs(aqs_layer.getLayers().map(function(l){return [l.getLatLng().lat, l.getLatLng().lng, "1"]}))
      }
    })

    // if on home page:
    if($(".home-map").length == 1){
      // show search box
      $("#pac-input").show()
      //  - load recently created and updated eggs
      $.each(["recently_created_at","recently_retrieved_at"],function(i,order){
        $.getJSON("/"+order+".json", function(data){
          $.each(data, function(i,egg){
            $("#"+order).append("<li><a href='/egg/"+egg.id+"'>"+egg.title+"</a> is a "+egg.status+" "+egg.location_exposure+" egg that was created "+moment(egg.created).fromNow()+" and last updated "+moment(egg.updated).fromNow()+" </li>")
          })
        })
      })
    }

    // if on dashboard
    if($(".dashboard-map")){
      graphEggHistoricalData();
    }


  }

  function handleNoGeolocation() {
    map.setView([46, -24], 2);
  }

  function addEggMapMarker(egg) {
    var marker = L.marker([egg.location_lat, egg.location_lon],  {icon: eggIcon})
    var html = "<div><strong>Air Quality Egg Details</strong><table class='popup_metadata' data-feed_id='"+egg.id+"'>"
    html += "<tr><td>Name </td><td> <a href='/egg/"+egg.id+"'>"+egg.title+"</a></td></tr>"
    html += "<tr><td>Description </td><td> "+egg.description+"</td></tr>"
    html += "<tr><td>Position </td><td> "+egg.location_exposure+" @ "+egg.location_ele+" elevation</td></tr>"
    html += "<tr><td>Status </td><td> "+egg.status+"</td></tr>"
    html += "<tr><td>Last Updated </td><td> "+moment(egg.updated).fromNow()+"</td></tr>"
    html += "<tr><td>Created </td><td> "+moment(egg.created).fromNow()+"</td></tr>"
    html += "</table><hr /><strong>Latest Readings</strong>"
    html += "<div id='egg_"+egg.id+"'></div></div>"
    marker.bindPopup(html)
    marker.on('click', onEggMapMarkerClick); 
    marker.addTo(egg_layer);
  }

  function onEggMapMarkerClick(e){
    var feed_id = $(".popup_metadata").data("feed_id")
    $.getJSON("/egg/"+feed_id+".json", function(data){
      var html = ""
      if(data.datastreams.no2){ html += "NO2: "+data.datastreams.no2.current_value + " " + data.datastreams.no2.unit.label + " (" + moment(data.datastreams.no2.at).fromNow() +  ")"}
      if(data.datastreams.co){ html += "<br />CO: "+data.datastreams.co.current_value + " " + data.datastreams.co.unit.label + " (" + moment(data.datastreams.co.at).fromNow() +  ")"}
      if(data.datastreams.humidity){ html += "<br />Humidity: "+data.datastreams.humidity.current_value + " " + data.datastreams.humidity.unit.label + " (" + moment(data.datastreams.humidity.at).fromNow() +  ")"}
      if(data.datastreams.temperature){ html += "<br />Temperature: "+data.datastreams.temperature.current_value + " " + data.datastreams.temperature.unit.label  + " (" + moment(data.datastreams.temperature.at).fromNow() +  ")"}
      if(html == ""){html += "<em>No recent data available</em>"}
      $("#egg_"+feed_id).html(html)
    })
  }

  function addAQSSiteMapMarker(aqs) {
    var marker = L.marker([aqs.lat, aqs.lon],  {icon: aqsIcon})
    var html = "<div><strong>AirNow AQS Site Details</strong><table class='popup_metadata' data-aqs_id='"+aqs.aqs_id+"'>"
    html += "<tr><td>Name / Code </td><td> <strong>"+aqs.site_name+" / "+aqs.aqs_id+"</strong></td></tr>"
    html += "<tr><td>Agency </td><td>"+aqs.agency_name+"</td></tr>"
    html += "<tr><td>Collects </td><td> "+aqs.parameter.split(",").join(", ")+"</td></tr>"
    html += "<tr><td>Position </td><td> "+aqs.elevation+" elevation</td></tr>"
    if(aqs.msa_name){html += "<tr><td>MSA </td><td> "+aqs.msa_name+"</td></tr>"}
    if(aqs.cmsa_name){html += "<tr><td>CMSA </td><td> "+aqs.cmsa_name+"</td></tr>"}
    html += "<tr><td>County </td><td> "+aqs.county_name+"</td></tr>"
    html += "<tr><td>Status </td><td> "+aqs.status+"</td></tr>"
    html += "</table><hr /><strong>Latest Readings</strong>"
    html += "<div id='aqs_"+aqs.aqs_id+"'></div></div>"
    marker.bindPopup(html)
    marker.on('click', onAQSSiteMapMarkerClick); 
    marker.addTo(aqs_layer);
  }

    function onAQSSiteMapMarkerClick(e){
    var aqs_id = $(".popup_metadata").data("aqs_id")
    $.getJSON("/aqs/"+aqs_id+".json", function(data){
      var html = ""
      $.each(data.epa_datas, function(n,i){
        html += i.parameter+": "+i.value+" "+i.unit+" ("+moment(i.date).format("MM/DD/YYYY")+")<br />"
      })
      if(html == ""){html += "<em>No recent data available</em>"}
      $("#aqs_"+aqs_id).html(html)
    })
  }




  //
  // LOCATION PICKER
  //

  // var locpic = new GMapsLatLonPicker(),
  //     locpicker = $(".gllpLatlonPicker").first(),
  //     locsearch = $(".gllpSearchField").first(),
  //     locsaved = parseInt($(".location-saved").first().val()),
  //     geolocate = function () {
  //       navigator.geolocation.getCurrentPosition(function(position) {
  //         $(".gllpLatitude").val(position.coords.latitude);
  //         $(".gllpLongitude").val(position.coords.longitude);
  //         $(".gllpZoom").val(13);
  //         locpic.custom_redraw();
  //       });
  //     };

  // if ( locpicker.length ) {

  //   locpic.init( locpicker );

  //   // search
  //   $(".gllpSearchField").keydown(function(event){
  //     if(event.keyCode == 13){
  //       locpic.performSearch( $(this).val(), false );
  //       event.preventDefault();
  //     }
  //   });

  //   // HTML5 geolocation
  //   if(!locsaved && navigator.geolocation) {
  //     geolocate();
  //   }
  //   if (navigator.geolocation) {
  //     $(".find-me").removeClass("hidden").on("click", function(event) {
  //       event.preventDefault();
  //       geolocate();
  //     });
  //   }

  // }

  //
  // CLAIMING FIELD
  //

  $(".claiming-form").on( "submit" , function (event) {
    var $this   = $(this),
        $input  = $this.find(".claiming-input"),
        $error  = $(".claiming-error");

    if ( $input.val() === "" ) {
      event.preventDefault();
      $error.html("Please enter a serial number").removeClass("hidden");
    }
    else {
      $(".claiming-button").val("Adding ...").addClass("button-green button-loading");
    }
  });

  $(".claiming-input").blur( function (event) {
    $(".claiming-error").addClass("hidden");
  });

  //
  // FORM VALIDATION
  //

  $('.form-validation').on( "submit" , function (event) {
    var $this       = $(this),
        $required   = $this.find(".field-required [data-validate]"),
        $submit     = $this.find('.button[type="submit"]'),
        error       = false;

    if ( $required.length ) {
      var errorify = function ( $bro, msg ) {
            var $other = $bro.siblings(".bubble-error");

            if ( $bro.val() === "" ) {
              error = true;

              if ( !$other.length ) {
                $("<span></span>", { "class" : "bubble bubble-error", html : msg }).hide().insertAfter( $bro ).slideDown(150);
              }
              else if ( $other.html() === msg ) {
                $other.slideDown(150);
              }
            }
            else {
              if ( $other.length || $other.html() === msg ) {
                $other.slideUp(150);
              }
            }
          };

      $required.each( function () {
        var $el   = $(this);

        if ( $el.get(0).tagName.toLowerCase() === "input" ) {
          errorify( $el, "This field cannot be blank" );
        }
        else if ( $el.get(0).tagName.toLowerCase() === "select" ) {
          errorify( $el, "Please select one of the options" );
        }
      });
    }

    if ( error ) {
      event.preventDefault();
      $(".bubble-error").first().prev().focus();
    }
    else {
      // success
      $submit.val("Saving ...").addClass("button-green button-loading");
    }
  });

  function graphEggHistoricalData(){
    // create skeleton chart
    $('#dashboard-xively-chart').highcharts({
        chart: {
            type: 'spline',
            zoomType: 'xy'
        },
        title: {
            text: "Egg's Datastreams"
        },
        xAxis: {
            type: 'datetime',
        },
        yAxis: [
          { title: { text: 'ppb (parts per billion)'}, min: 0},
          { title: {text: ''}, min: 0, opposite: true }
        ],
        series: []
    });

    $(datastreams).each(function(n,i){
      xively.datastream.history(feed_id,i, {duration:"14days",interval:7200,limit:1000}, graphEggDatastream)
    })

  }

  function graphEggDatastream(data){
    var new_series = {id: data.id, name: data.id.split("_")[0]}

    // put CO and NO2 on yAxisY=0, all others on the second (right) y-axis
    if(new_series.name == "CO" || new_series.name == "NO2"){
      new_series.yAxis = 0;
    } else {
      new_series.yAxis = 1;
    }
    new_series.data = $(data.datapoints).map(function(n,i){
      var date = new Date(i.at)
      return {x: date.getTime(),y: parseFloat(i.value)}
    })
    console.log(new_series)
    // xively.datastream.history("2017904434","CO_raw_00-04-a3-d5-ee-ca_1", {duration:"7days",interval:3600,limit:1000}, function(data){console.log(data)})
    $('#dashboard-xively-chart').highcharts().addSeries(new_series)
  }


})( jQuery );
