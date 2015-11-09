// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.controllers' is found in controllers.js
angular.module('starter', ['ionic', 'ngCordova'])


.run(function($ionicPlatform, GoogleMaps) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if(window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if(window.StatusBar) {
      StatusBar.styleDefault();
    }
 
    GoogleMaps.init();
  });
})

.config(function($stateProvider, $urlRouterProvider) {
 
  $stateProvider
  .state('map', {
    url: '/',
    templateUrl: 'templates/map.html',
    controller: 'MapCtrl'
  });
 
  $urlRouterProvider.otherwise("/");
 
})



.controller('MapCtrl', function($scope, $state, $cordovaGeolocation) {
 
})

.factory('Markers', function($http) {
 
  var markers = [];
 
  return {
    getMarkers: function(params){
 
      return $http.get("js/markers.json",{params:params}).then(function(response){
          markers = response;
          return markers;
      });
 
    }
  }
 
})

.factory('ConnectivityMonitor', function($rootScope, $cordovaNetwork){
 
  return {
    isOnline: function(){
 
      if(ionic.Platform.isWebView()){
        return $cordovaNetwork.isOnline();    
      } else {
        return navigator.onLine;
      }
 
    },
    ifOffline: function(){
 
      if(ionic.Platform.isWebView()){
        return !$cordovaNetwork.isOnline();    
      } else {
        return !navigator.onLine;
      }
 
    }
  }
})
.factory('GoogleMaps', function($cordovaGeolocation, $ionicLoading, 
$rootScope, $cordovaNetwork, Markers, ConnectivityMonitor){
 
  var markerCache = [];
  var apiKey = false;
  var map = null;
 
  function initMap(){
 
    var options = {timeout: 10000, enableHighAccuracy: true};
 
    $cordovaGeolocation.getCurrentPosition(options)
.then(function(position){
 
      var latLng = new google.maps.LatLng(position.coords.latitude, 
position.coords.longitude);
 
      var mapOptions = {
        center: latLng,
        zoom: 15,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      };
 
      map = new google.maps.Map(document.getElementById("map"), 
mapOptions);
 
      //Wait until the map is loaded
      google.maps.event.addListenerOnce(map, 'idle', function(){
        loadMarkers();
 
        //Reload markers every time the map moves
        google.maps.event.addListener(map, 'dragend', function(){
          console.log("moved!");
          loadMarkers();
        });
 
        //Reload markers every time the zoom changes
        google.maps.event.addListener(map, 'zoom_changed', function(){
          console.log("zoomed!");
          loadMarkers();
        });
 
        enableMap();
 
      });
 
    }, function(error){
      console.log("Could not get location");
    });
 
  }
 
  function enableMap(){
    $ionicLoading.hide();
  }
 
  function disableMap(){
    $ionicLoading.show({
      template: 'You must be connected to the Internet to view this map.'
    });
  }
 
  function loadGoogleMaps(){
 
    $ionicLoading.show({
      template: 'Loading Google Maps'
    });
 
    //This function will be called once the SDK has been loaded
    window.mapInit = function(){
      initMap();
    };  
 
    //Create a script element to insert into the page
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.id = "googleMaps";
 
    //Note the callback function in the URL is the one we created above
    if(apiKey){
      script.src = 'http://maps.google.com/maps/api/js?key=' + apiKey 
+ '&sensor=true&callback=mapInit';
    }
    else {
script.src = 'http://maps.google.com/maps/api/js?sensor=true&callback=mapInit';
    }
 
    document.body.appendChild(script);
 
  }
 
  function checkLoaded(){
    if(typeof google == "undefined" || typeof google.maps == "undefined"){
      loadGoogleMaps();
    } else {
      enableMap();
    }       
  }
 
  function loadMarkers(){
 
      var center = map.getCenter();
      var bounds = map.getBounds();
      var zoom = map.getZoom();
 
      //Convert objects returned by Google to be more readable
      var centerNorm = {
          lat: center.lat(),
          lng: center.lng()
      };
 
      var boundsNorm = {
          northeast: {
              lat: bounds.getNorthEast().lat(),
              lng: bounds.getNorthEast().lng()
          },
          southwest: {
              lat: bounds.getSouthWest().lat(),
              lng: bounds.getSouthWest().lng()
          }
      };
 
      var boundingRadius = getBoundingRadius(centerNorm, boundsNorm);
 
      var params = {
        "centre": centerNorm,
        "bounds": boundsNorm,
        "zoom": zoom,
        "boundingRadius": boundingRadius
      };
 
      var markers = Markers.getMarkers(params).then(function(markers){
        console.log("Markers: ", markers);
        var records = markers.data;
 
        for (var i = 0; i < records.length; i++) {
 
          var record = records[i];
 
          // Check if the marker has already been added
          if (!markerExists(record.lat, record.lng)) {
 
              var markerPos = new google.maps.LatLng(record.lat, record.lng);
              // add the marker
              var marker = new google.maps.Marker({
                  map: map,
                  animation: google.maps.Animation.DROP,
                  position: markerPos
              });
 
// Add the marker to the markerCache so we know not to add it again later
              var markerData = {
                lat: record.lat,
                lng: record.lng,
                marker: marker
              };
 
              markerCache.push(markerData);
 
              var infoWindowContent = "<h4>" + record.name + "</h4>";          
 
              addInfoWindow(marker, infoWindowContent, record);
          }          
 
        }
 
      });    
  }
 
  function markerExists(lat, lng){
      var exists = false;
      var cache = markerCache;
      for(var i = 0; i < cache.length; i++){
        if(cache[i].lat === lat && cache[i].lng === lng){
          exists = true;
        }
      }
 
      return exists;
  }
 
  function getBoundingRadius(center, bounds){
    return getDistanceBetweenPoints(center, bounds.northeast, 'miles');    
  }
 
  function getDistanceBetweenPoints(pos1, pos2, units){
 
    var earthRadius = {
        miles: 3958.8,
        km: 6371
    };
 
    var R = earthRadius[units || 'miles'];
    var lat1 = pos1.lat;
    var lon1 = pos1.lng;
    var lat2 = pos2.lat;
    var lon2 = pos2.lng;
 
    var dLat = toRad((lat2 - lat1));
    var dLon = toRad((lon2 - lon1));
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
 
    return d;
 
  }
 
  function toRad(x){
      return x * Math.PI / 180;
  }
 
  function addInfoWindow(marker, message, record) {
 
      var infoWindow = new google.maps.InfoWindow({
          content: message
      });
 
      google.maps.event.addListener(marker, 'click', function () {
          infoWindow.open(map, marker);
      });
 
  }
 
  function addConnectivityListeners(){
 
    if(ionic.Platform.isWebView()){
 
      // Check if the map is already loaded when the user comes online, 
//if not, load it
      $rootScope.$on('$cordovaNetwork:online', function(event, networkState){
        checkLoaded();
      });
 
      // Disable the map when the user goes offline
      $rootScope.$on('$cordovaNetwork:offline', function(event, networkState){
        disableMap();
      });
 
    }
    else {
 
      //Same as above but for when we are not running on a device
      window.addEventListener("online", function(e) {
        checkLoaded();
      }, false);    
 
      window.addEventListener("offline", function(e) {
        disableMap();
      }, false);  
    }
 
  }
 
  return {
    init: function(key){
 
      if(typeof key != "undefined"){
        apiKey = key;
      }
 
      if(typeof google == "undefined" || typeof google.maps == "undefined"){
 
        console.warn("Google Maps SDK needs to be loaded");
 
        disableMap();
 
        if(ConnectivityMonitor.isOnline()){
          loadGoogleMaps();
        }
      }
      else {
        if(ConnectivityMonitor.isOnline()){
          initMap();
          enableMap();
        } else {
          disableMap();
        }
      }
 
      addConnectivityListeners();
 
    }
  }
 
});
