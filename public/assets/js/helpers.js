function getURLParameterByKey(name,hash) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  if(hash == true){
    var regex = new RegExp("[\\?&#]" + name + "=([^&#]*)")
    var results = regex.exec(location.hash)
  }
  else {
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)")
    var results = regex.exec(location.search)
  }
  return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function addOrReplacePairInHash(key,new_value){
  var current_value = getURLParameterByKey(key,true)
  if(current_value){
    if(current_value == new_value){ } // do nothing
    else{
      // replace value
      var current_hash = location.hash
      location.hash = current_hash.replace(key+'='+encodeURIComponent(current_value),key+'='+new_value)
    }
  } else {
    location.hash += '&'+key+'='+new_value
  }
}
function celsiusToFahrenheit(value){
  return parseFloat(value) * 9 / 5 + 32
}

function toTitleCase(str){
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

function aqiToColor(aqi){
  var color;
  if (aqi <= 50) { color = "#00E400" }
  else if(aqi > 51 && aqi <= 100) { color = "#FFFF00"}
  else if(aqi > 101 && aqi <= 150) { color = "#FF7E00"}
  else if(aqi > 151 && aqi <= 200) { color = "#FF0000"}
  else if(aqi > 201 && aqi <= 300) { color = "#99004C"}
  else if(aqi > 301 && aqi <= 500) { color = "#4C0026"}
  else { color = "#000000"}
  return color;
}