$(function() {
  $("tr[data-sensor-id]").each(function(n,row){
    var type = $(row).data("sensor-type")
    var id = $(row).data("sensor-id")
    var detail = $(row).data("detail-level")
    $.getJSON("/"+type+"/"+id+".json", function(data,status){

      if(data.status == "not_found"){
        $(row).find(".sensor-status").html("not_found")
        $(row).addClass("danger")
        $(row).children('td').last().html("No data for this site")
        move_row_to_top(row)
        $(".num-sensors-not_found").html(parseInt($(".num-sensors-not_found").html()) + 1)
      }
      else {
        $(row).find(".sensor-title").html(data.site_name || data.title)
        $(row).find(".sensor-description").html(data.msa_name || data.cmsa_name || data.description)
        if(detail == "dashboard"){
          if(data.status == "frozen"){
            $(row).addClass("warning")
            $(".num-sensors-frozen").html(parseInt($(".num-sensors-frozen").html()) + 1)
            move_row_to_top(row)
          } else {
            $(row).addClass("success")
            $(".num-sensors-live").html(parseInt($(".num-sensors-live").html()) + 1)
          }
          $(row).find(".sensor-status").html(data.status)
          $(row).find(".sensor-created_at").html(moment(data.created).fromNow()+" ("+moment(data.created).calendar()+")")
        }
        var html = formatSensorDetails(data)
        $(row).children('td').last().html(html)
      } 
    })
	})
})
