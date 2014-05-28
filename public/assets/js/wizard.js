var rules;
$(function() { 
var endpoint = "http://54.204.10.90:5000/api"
var ckan = new CKAN.Client(endpoint)

var DataView = Backbone.View.extend({
  class: 'data-view',
  initialize: function(options) {
    var self = this;
    // var resource = new Backbone.Model
    this.dataset = new recline.Model.Dataset({
      id: options.resourceId,
      endpoint: endpoint,
      backend: 'ckan'
    });
    this.dataset.fetch()
      .done(function() {
        self.render();
      });
  },

  render: function() {
    var html = Mustache.render(this.template, {resource: this.dataset.toJSON()});
    this.$el.html(html);

    this.view = this._makeMultiView(this.dataset, this.$el.find('.multiview'));
    this.dataset.query({size: this.dataset.recordCount});
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
    var mapView = {
      id: 'map',
      label: 'Map',
      view: new recline.View.Map({
        model: dataset
      })
    };
    view = new recline.View.MultiView({
      model: dataset,
      views: [gridView, graphView, mapView],
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
      <textarea class="form-control" style="width: 100%;">SELECT * FROM "{{resource.id}}"</textarea> \
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
    // $(".wizardify").bootstrapWizard({'tabClass': 'bwizard-steps'});
    $('.wizardify').bootstrapWizard({
      tabClass: 'bwizard-steps',
      onNext: function(tab, navigation, index) {
        if(index==1) {
          if($("#tab1 .checkbox input:checked").length != 1){
            alert("Please select exactly one dataset to build a visualization off of.")
            return false;
          }

        }
        if(index==2) {
          var view = new DataView({
            resourceId: $(".resource-choose:checked").data("resource-id"),
            el: $(".data-view")
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


  // $('#query-builder').queryBuilder({
  //   filters: [{
  //     id: 'name',
  //     label: 'Name',
  //     type: 'string',
  //     operators: ['equal', 'not_equal', 'is_null', 'is_not_null']
  //   }, {
  //     id: 'category',
  //     label: 'Category',
  //     type: 'integer',
  //     input: 'select',
  //     multiple: true,
  //     values: {
  //       1: 'Books',
  //       2: 'Movies',
  //       3: 'Music',
  //       4: 'Tools',
  //       5: 'Goodies',
  //       6: 'Clothes'
  //     },
  //     operators: ['equal', 'not_equal', 'is_null', 'is_not_null']
  //   }]
  // })

  // $('#query-builder-submit').on('click', function() {
  //   rules = $('#query-builder').queryBuilder('getRules')
  //   $('#query-result')
  //     .find('pre').html(JSON.stringify(rules, undefined, 2));
  //   console.log(rules)
  // });


});