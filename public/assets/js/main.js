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

  initialize()

  function initialize() {
    // load feeds and then initialize map and add the markers
    if(local_feed_path){
      // set up leaflet map
      map = L.map('map_canvas', {scrollWheelZoom: false})
      handleNoGeolocation();
      L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: 'Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
          maxZoom: 18
      }).addTo(map);

      $.getJSON(local_feed_path, function(mapmarkers){
        // if on an egg's page, zoom in close to the egg
        if ( $(".dashboard-map").length && mapmarkers && mapmarkers.length ) {
          map.setView(L.latLng(mapmarkers[0].lat,mapmarkers[0].lng))          
        }

        // add eggs to map
        for ( var x = 0, len = mapmarkers.length; x < len; x++ ) {
          addEggMapMarker(mapmarkers[x]);
        }

        $("span#num_eggs").html(mapmarkers.length)
      })
    }

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
      //  - load active AQS stations to map      
      $.getJSON("/all_aqs_sites.json", function(aqs_mapmarkers){
        for ( var x = 0, len = aqs_mapmarkers.length; x < len; x++ ) {
          addAQSSiteMapMarker( aqs_mapmarkers[x] );
        }
      })

    }

  }


  function zoomToUserLocation(){
    if(navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        map.setView([position.coords.latitude,position.coords.longitude],10)
      });
    } else {
      handleNoGeolocation()
    }    
  }


  function handleNoGeolocation() {
    map.setView([46, -24], 2);
  }

  function addEggMapMarker(details) {
    var marker = L.marker([details.lat, details.lng],  {icon: eggIcon})
    marker.bindPopup(details.title+"<br /><a href='/egg/"+details.feed_id+"'>Egg details</a>")
    marker.addTo(map);
  }

  // TODO - refactor
  function addAQSSiteMapMarker(details) {
    var marker = L.marker([details.lat, details.lng],  {icon: aqsIcon})
    marker.bindPopup(details.title+"<br /><a href='/aqs/"+details.aqs_id+"'>AQS details</a>")
    marker.addTo(map);
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

