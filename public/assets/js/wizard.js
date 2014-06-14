var aceEditor, mapView
$(function() { 

  // highly based on rgrp's ckan data explorer
  var ckan = new CKAN.Client(ckan_endpoint)
  var ace_sql_editor;
  var DataView = Backbone.View.extend({
    class: 'data-view',
    initialize: function(options) {
      var self = this;
      // var resource = new Backbone.Model
      this.dataset = new recline.Model.Dataset({
        id: options.resourceId,
        endpoint: ckan_endpoint,
        backend: 'ckan',
        initialSql: options.initialSql,
        isJoin: options.isJoin,
        datasetKeys: options.datasetKeys
      });
      this.dataset.fetch()
        .done(function() {
          self.render();
        });
    },
    render: function() {
      this.view = this._makeMultiView(this.dataset, this.$el.find('.multiview'));
      
      var sqlSamples = $.map(datasets[dataset_key].extras_hash, function(value,key){
        console.log(key)
        if(key.match("SQL Sample")){
          return {title: dataset_key.toUpperCase()+" "+key, sql: value}
        }
      })

      console.log(sqlSamples)

      var html = Mustache.render(this.template, {initialSql: this.dataset.attributes.initialSql, sqlSamples: sqlSamples});
      this.$el.html(html);


      console.log(this.dataset)
      if(this.dataset.attributes.isJoin == false){      
        $.each(this.dataset.fields.models, function(n,field){
          $(".resource-fields tbody").append("<tr><td>"+field.attributes.id+"</td><td>"+field.attributes.type+"</td></tr>")
        })
        $(".resource-fields").height($(".sql-examples").height()+20)
      } else {
        $(".resource-fields").html("<p>Fields for joins coming soon!</p>")
      }

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

      filtersView = {
        id: 'filterEditor',
        label: 'Filters',
        view: new recline.View.FilterEditor({
          model: dataset
        })
      }

      fieldsView = {
        id: 'fieldsView',
        label: 'Fields',
        view: new recline.View.Fields({
          model: dataset
        })
      }

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
        sidebarViews: [fieldsView,filtersView],
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
      <div class="row"> \
        <div class="col-md-9"> \
          <div class="panel panel-default"> \
            <div class="panel-heading"> \
              <h4 class="panel-title">Example SQL Queries</h4> \
            </div> \
            <div class="panel-collapse collapse in"> \
              <div class="panel-body"> \
                <div class="sql-examples"> \
                  <div class="table-responsive"> \
                    <table class="table table-bordered table-striped"> \
                        <thead> \
                          <tr> \
                            <th>Name</th> \
                            <th>SQL</th> \
                          </tr> \
                        </thead> \
                        <tbody> \
                          {{#sqlSamples}}\
                            <tr class="example-query">\
                                <td class="example-sql-description"><a href="#" data-sql="{{sql}}">{{title}}</a></td>\
                                <td><span style="font-family: monospace">{{sql}}</span></td>\
                            </tr>\
                          {{/sqlSamples}}" \
                        </tbody> \
                    </table> \
                  </div> \
                </div> \
              </div> \
            </div> \
          </div> \
        </div> \
        <div class="col-md-3"> \
          <div class="panel panel-default"> \
            <div class="panel-heading"> \
              <h4 class="panel-title">Dataset Metadata</h4> \
            </div> \
            <div class="panel-collapse collapse in"> \
              <div class="panel-body"> \
                <h5>Fields/Columns</h5> \
                <div class="resource-fields" style="overflow:scroll;"> \
                  <div class="table-responsive"> \
                    <table class="table table-bordered table-striped"> \
                      <thead> \
                          <tr> \
                              <th>Name</th> \
                              <th>Type</th> \
                          </tr> \
                      </thead> \
                      <tbody> \
                      </tbody> \
                    </table> \
                  </div> \
                </div> \
              </div> \
            </div> \
          </div> \
        </div> \
      </div> \
      <div class="panel panel-default"> \
        <div class="panel-heading"> \
          <h4 class="panel-title">SQL Query</h4> \
        </div> \
        <div class="panel-collapse collapse in"> \
          <div class="panel-body"> \
            <form class="form query-sql" role="form"> \
              <div class="form-group"> \
              <div id="sql-query" style="width:100%; height:150px;">{{initialSql}}</div> \
              </div> \
              <div class="sql-error alert alert-error alert-danger" style="display: none;"></div> \
              <button type="submit" class="btn btn-primary btn-default">Query</button> \
              </div> \
            </form> \
          </div> \
        </div> \
      </div> \
      <div class="panel panel-default"> \
        <div class="panel-heading"> \
          <h4 class="panel-title">Results: Browse, Visualize, and/or Export</h4> \
        </div> \
        <div class="panel-collapse collapse in"> \
          <div class="panel-body"> \
            <div class="sql-results"></div> \
            <div class="multiview"></div> \
          </div> \
        </div> \
      </div> \
      ',

    sqlQuery: function(e) {
      var self = this;
      e.preventDefault();

      var $error = this.$el.find('.sql-error');
      $error.hide();
      var sql = aceEditor.getValue()// this.$el.find('.query-sql textarea').val();
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


  // data visualization wizard
  if($(".wizardify").length){
    var dataset_key, resource_id, chosen_resource;
    // $(".wizardify").bootstrapWizard({'tabClass': 'bwizard-steps'});
    $('.wizardify').bootstrapWizard({
      tabClass: 'bwizard-steps',
      onTabShow: function(tab, navigation, index) {
        if(index == 1){
          setTimeout(function(){
            aceEditor = ace.edit("sql-query");
            aceEditor.getSession().setMode("ace/mode/sql");
            aceEditor.getSession().setWrapLimitRange(80,120);
            aceEditor.getSession().setUseWrapMode(true);     
          }, 1000);
        }
      },
      onNext: function(tab, navigation, index) {
        if(index==1) {
          var chosen_dataset_keys = _.map($("#tab1 .checkbox input:checked"),function(x){return $(x).data("dataset-key")}).sort()
          if ( chosen_dataset_keys.toString() == datasets_sites_joinable.toString() ){ // doing am allowed join
          } else if( chosen_dataset_keys.length != 1 ){
            alert("Please select exactly one dataset to build a visualization off of or select datasets that can be joined together")
            return false;
          }

          chosen_resource = $(".resource-choose:checked")
          dataset_key = chosen_resource.data("dataset-key")
          resource_id = chosen_resource.data("resource-id")
          $(".sql-examples tbody").html("")

          // only show examples if we are dealing with just one data set (not a join)
          if(chosen_dataset_keys.length == 1){

            var isJoin = false
            if(datasets[dataset_key]['extras_hash']['Default SQL']){
              var initialSql = datasets[dataset_key]['extras_hash']['Default SQL']
            } else {
              var initialSql = 'SELECT * FROM "'+resource_id+'"'
            }
            
            // show SQL query examples, if there are any

          } else { // for joins
            var isJoin = true
            var datasets_sites_join_sql = _.map(chosen_dataset_keys, function(chosen_dataset_key){
              return datasets[chosen_dataset_key]["site_join_sql"]
            }).join(" UNION ")
            console.log(datasets_sites_join_sql)
            $("#sql-query").val(datasets_sites_join_sql)
            var initialSql = datasets_sites_join_sql
            $(".sql-examples tbody").append("<tr class='example-query'><td class='example-sql-description'><strong><a href='#' data-sql='"+initialSql+"'>Default SQL for joining "+chosen_dataset_keys.join('/')+" datasets together</a></strong><td class='example-sql'><span style='font-family: monospace'>"+initialSql+"</span></td></tr>")
          }

          var view = new DataView({
            resourceId: resource_id,
            el: $(".data-view"),
            initialSql: initialSql,
            isJoin: isJoin,
            datasetKeys: chosen_dataset_keys
          });

        }
      }
    });

  }

  $(".example-sql-description a").live('click', function(e) {
    e.preventDefault();
    
    var sql = $(e.target).data("sql")
    aceEditor.setValue(sql)
  })

  $(".zoom-to-city").live('click', function(e, target){
    e.preventDefault();
    mapView.view.map.setView(focus_city.latlon, focus_city.zoom)
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