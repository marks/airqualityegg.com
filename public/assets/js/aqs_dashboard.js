// var map;

$(function() {
    $(".momentify").each(function(n,item){
      var original = $(item).html()
      var from_now = moment(original).fromNow()
      $(item).html("<abbr title='"+original+"'>"+from_now+"</abbr>")
    })

  $("tr[data-sensor-id]").each(function(n,row){
    var type = $(row).data("sensor-type")
    var id = $(row).data("sensor-id")
    var detail = $(row).data("detail-level")
    var param = $(row).data("sensor-param")
    var site_name = $(row).data("sensor-title")
    $.getJSON("/"+type+"/"+id+"/"+param+"/past_24h_aqi_chart.json", function(chart_data,status){
      $(row).children('td').last().find(".past24chart").highcharts({
        chart: { type: 'column' },
        credits: { enabled: false },
        legend: { enabled: false },
        title: { text: 'AQI for the Past 24 Hours at '+site_name +' (GMT)'},
        xAxis: { type: 'datetime' },
        yAxis: { min: 0, title: {enabled: false} },
        tooltip: {
          headerFormat: '<span style="font-size:10px">{point.key}</span><table>',
          pointFormat: '<tr><td style="color:{series.color};padding:0">{series.name}: </td>' +
              '<td style="padding:0"><b> {point.y}</b></td></tr>',
          footerFormat: '</table>',
          shared: true,
          useHTML: true
        },
        plotOptions: {
            column: {
                pointPadding: 0.2,
                borderWidth: 0
            }
        },
        series: chart_data
      });
      $(window).resize()
    })
  })

})

  