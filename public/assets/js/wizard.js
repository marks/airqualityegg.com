var rules, mapView
$(function() { 
  var ckan = new CKAN.Client(ckan_endpoint)

  var DataView = Backbone.View.extend({
    class: 'data-view',
    initialize: function(options) {
      var self = this;
      // var resource = new Backbone.Model
      this.dataset = new recline.Model.Dataset({
        id: options.resourceId,
        endpoint: ckan_endpoint,
        backend: 'ckan',
        initialSql: options.initialSql
      });
      this.dataset.fetch()
        .done(function() {
          self.render();
        });
    },
    render: function() {
      this.view = this._makeMultiView(this.dataset, this.$el.find('.multiview'));
      
      var html = Mustache.render(this.template, {initialSql: this.view.model.attributes.initialSql});
      this.$el.html(html);

      // this.dataset.query({size: this.dataset.recordCount});
    },

    _makeMultiView: function(dataset, $el) {
      var gridView = {
          id: 'grid',
          label: 'Grid',
          view: new recline.View.SlickGrid({
            model: dataset,
          })
        };
      var graphView = {
        id: 'graph',
        label: 'Graph',
        view: new recline.View.Flot({
          model: dataset
        })
      };
      mapView = {
        id: 'map',
        label: 'Map',
        view: new recline.View.Map({
          model: dataset,
        })
      };

      exportView = {
        id: 'export',
        label: 'Export',
        view: new recline.View.Export({
          model: dataset, // recline dataset
          size: 5 // optional, show only first 5 records in preview (default 10)
        })
      };

      mapView.view.geoJsonLayerOptions.onEachFeature = function(feature, layer){
        var attributes = view.model.records._byId[feature.properties.cid].attributes
        var aqi = attributes.computed_aqi
        if(aqi){
          var aqi_css_class = aqiToColor(aqi).replace("#","")
          layer.setIcon(L.divIcon({className: 'aqi-bg-'+aqi_css_class+' leaflet-div-icon'}))        
        } else {
          layer.setIcon(L.divIcon({className: 'leaflet-div-icon'}))        
        }
      }

      view = new recline.View.MultiView({
        model: dataset,
        views: [gridView, graphView, mapView, exportView],
        sidebarViews: [],
        el: $el,
        disablePager: true,
        disableQueryEditor: true
      });
      return view;
    },


    events: {
      'submit .query-sql': 'sqlQuery'
    },

    template: ' \
      <form class="form query-sql" role="form"> \
        <label>SQL Query</label> \
        <p class="help-block">Query this table using SQL via the <a href="http://docs.ckan.org/en/latest/maintaining/datastore.html#ckanext.datastore.logic.action.datastore_search_sql">DataStore SQL API</a></p> \
        <div class="form-group"> \
        <textarea class="form-control sql-query-textarea" style="width: 100%;">{{initialSql}}</textarea> \
        </div> \
        <div class="sql-error alert alert-error alert-danger" style="display: none;"></div> \
        <button type="submit" class="btn btn-primary btn-default">Query</button> \
        </div> \
      </form> \
      <hr /> \
      <div class="sql-results"></div> \
      <div class="multiview"></div> \
      ',

    sqlQuery: function(e) {
      var self = this;
      e.preventDefault();

      var $error = this.$el.find('.sql-error');
      $error.hide();
      var sql = this.$el.find('.query-sql textarea').val();
      // replace ';' on end of sql as seems to trigger a json error
      sql = sql.replace(/;$/, '');
      ckan.datastoreSqlQuery(sql, function(err, data) {
        if (err) {
          var msg = '<p>Error: ' + err.message + '</p>';
          $error.html(msg);
          $error.show('slow');
          return;
        }

        // now handle good case ...
        var dataset = new recline.Model.Dataset({
          records: data.hits,
          fields: data.fields
        });
        dataset.fetch();
        // destroy existing view ...
        var $el = $('<div />');
        $('.sql-results').append($el);
        if (self.sqlResultsView) {
          self.sqlResultsView.remove();
        }

        $(".multiview").hide()

        self.sqlResultsView = self._makeMultiView(dataset, $el);
        dataset.query({size: dataset.recordCount});
      });
    }
  });

  if($(".wizardify").length){
    var dataset_key, resource_id, chosen_resource;
    // $(".wizardify").bootstrapWizard({'tabClass': 'bwizard-steps'});
    $('.wizardify').bootstrapWizard({
      tabClass: 'bwizard-steps',
      onNext: function(tab, navigation, index) {
        if(index==1) {
          var chosen_dataset_keys = _.map($("#tab1 .checkbox input:checked"),function(x){return $(x).data("dataset-key")}).sort()
          if(chosen_dataset_keys.length != 1){
            if(chosen_dataset_keys.toString() == datasets_sites_joinable.toString()){
              return true
            }
            alert("Please select exactly one dataset to build a visualization off of or select datasets that can be joined together")
            return false;
          }
        }
        if(index==2) {
          chosen_resource = $(".resource-choose:checked")
          dataset_key = chosen_resource.data("dataset-key")
          resource_id = chosen_resource.data("resource-id")
          $(".sql-examples tbody").html("")

          // only show examples if we are dealing with just one data set (not a join)
          if(chosen_resource.length == 1){
            var initialSql = 'SELECT * FROM "'+resource_id+'"'            

            // show SQL query examples, if there are any
            var example_count = 0
            $.each(datasets[dataset_key].extras_hash, function(key,value){
              if(key.match("SQL Sample")){
                $(".sql-examples tbody").append("<tr class='example-query'><td class='example-sql-description'><strong><a href='#'>"+dataset_key.toUpperCase()+" "+key+"</a></strong><td class='example-sql'><span style='font-family: monospace'>"+value+"</span></td></tr>")
                example_count += 1
              }
            })
            if(example_count == 0){
              $(".sql-examples").hide()
            }
          } else { // for joins
            var chosen_dataset_keys = _.map($("#tab1 .checkbox input:checked"),function(x){return $(x).data("dataset-key")}).sort()
            var datasets_sites_join_sql = _.map(chosen_dataset_keys, function(chosen_dataset_key){
              return datasets[chosen_dataset_key]["site_join_sql"]
            }).join(" UNION ")
            console.log(datasets_sites_join_sql)
            $(".sql-query-textarea").val(datasets_sites_join_sql)
            var initialSql = datasets_sites_join_sql
            $(".sql-examples tbody").append("<tr class='example-query'><td class='example-sql-description'><strong><a href='#'>Default SQL for joining "+chosen_dataset_keys.join('/')+" datasets together</a></strong><td class='example-sql'><span style='font-family: monospace'>"+initialSql+"</span></td></tr>")
          }

          var view = new DataView({
            resourceId: resource_id,
            el: $(".data-view"),
            initialSql: initialSql
          });


        }
        // var debug = ""
        // $("input").each(function(x,y){
        //   debug += $(y).attr("name") + " = <pre>" + $(y).val() + "</pre>"
        // })
        // $("#wizard-data").html(debug)          
      }
    });

  }

  $(".example-sql-description").live('click', function(e, target) {
    e.preventDefault();
    var sql_td = $(e.target).parent().parent().parent().find(".example-sql")
    $(".sql-query-textarea").val(sql_td.text())
  })


});

function celsiusToFahrenheit(value){
  return parseFloat(value) * 9 / 5 + 32
}

function aqiToColor(aqi){
  // var aqi = (range[0]+range[1])/2.00
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