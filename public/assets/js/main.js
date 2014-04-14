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

  var egg_layer = L.layerGroup([]);
  var egg_heatmap = L.heatLayer([], {radius: 25})
  var egg_heatmap_layer = L.layerGroup([egg_heatmap])
  var aqs_layer = L.layerGroup([]);
  var aqs_heatmap = L.heatLayer([], {radius: 25})
  var aqs_heatmap_layer = L.layerGroup([aqs_heatmap])


  var overlays = {"Air Quality Eggs": egg_layer, "Air Quality Eggs Heatmap": egg_heatmap_layer, "AirNow AQS Sites": aqs_layer, "AirNow AQS Sites Heatmap": aqs_heatmap_layer}

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
      L.control.layers([], overlays).addTo(map);
      L.control.locate({locateOptions: {maxZoom: 9}}).addTo(map);

      $.getJSON(local_feed_path, function(mapmarkers){
        // if on an egg's page, zoom in close to the egg
        if ( $(".dashboard-map").length && mapmarkers && mapmarkers.length ) {
          console.log(mapmarkers[0])
          map.setView([mapmarkers[0].location_lat,mapmarkers[0].location_lon],6)
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
      if(eventLayer.name == "Air Quality Eggs Heatmap"){
        egg_heatmap.setLatLngs(egg_layer.getLayers().map(function(l){return [l.getLatLng().lat, l.getLatLng().lng, "1"]}))
      }
      if(eventLayer.name == "AirNow AQS Sites Heatmap"){
        aqs_heatmap.setLatLngs(aqs_layer.getLayers().map(function(l){return [l.getLatLng().lat, l.getLatLng().lng, "1"]}))
      }
    })

    // if on home page:
    if($(".home-map").length != []){
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

  }

  function handleNoGeolocation() {
    map.setView([46, -24], 2);
  }

  function addEggMapMarker(egg) {
    var marker = L.marker([egg.location_lat, egg.location_lon],  {icon: eggIcon})
    var html = "<table class='map_popup'>"
    html += "<tr><td>Name </td><td> <a href='/egg/"+egg.id+"'><strong>"+egg.title+"</strong></a></td></tr>"
    html += "<tr><td>Description </td><td> "+egg.description+"</td></tr>"
    html += "<tr><td>Position </td><td> "+egg.location_exposure+" @ "+egg.location_ele+" elevation</td></tr>"
    html += "<tr><td>Status </td><td> "+egg.status+"</td></tr>"
    html += "<tr><td>Last Updated </td><td> "+moment(egg.updated).fromNow()+"</td></tr>"
    html += "<tr><td>Created </td><td> "+moment(egg.created).fromNow()+"</td></tr>"
    marker.bindPopup(html)
    marker.addTo(egg_layer);
  }

  // TODO - refactor
  function addAQSSiteMapMarker(aqs) {
    var marker = L.marker([aqs.lat, aqs.lon],  {icon: aqsIcon})
    var html = "<table class='map_popup'>"
    html += "<tr><td>Name / Code </td><td> <strong>"+aqs.site_name+" / "+aqs.aqs_id+"</strong></td></tr>"
    html += "<tr><td>Agency </td><td>"+aqs.agency_name+"</td></tr>"
    html += "<tr><td>Collects </td><td> "+aqs.parameter.split(",").join(", ")+"</td></tr>"
    html += "<tr><td>Position </td><td> "+aqs.elevation+" elevation</td></tr>"
    if(aqs.msa_name){html += "<tr><td>MSA </td><td> "+aqs.msa_name+"</td></tr>"}
    if(aqs.cmsa_name){html += "<tr><td>CMSA </td><td> "+aqs.cmsa_name+"</td></tr>"}
    html += "<tr><td>County </td><td> "+aqs.county_name+"</td></tr>"
    html += "<tr><td>Status </td><td> "+aqs.status+"</td></tr>"
    marker.bindPopup(html)
    marker.addTo(aqs_layer);
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

  //<span class="bubble bubble-error hiden">This field cannot be blank</span>

})( jQuery );
