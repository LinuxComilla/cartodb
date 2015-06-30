var cdb = require('cartodb.js');
var Utils = require('cdb.Utils');
var BaseDialog = require('../../views/base_dialog/view');
var ViewFactory = require('../../view_factory');
var randomQuote = require('../../view_helpers/random_quote');

module.exports = BaseDialog.extend({

  _TABS_PER_ROW: 3,

  events: cdb.core.View.extendEvents({
    "click .js-goPrev": "_prevPage",
    "click .js-goNext": "_nextPage",
    "click .js-skip"  : "_onSkipClick"
  }),

  initialize: function() {
    this.elder('initialize');

    if (!this.options.table) {
      throw new Error('table is required');
    }

    this._initModels();
    this._initViews();
    this._initBinds();
  },

  render_content: function() {
    return this._panes.getActivePane().render().el;
  },

  render: function() {
    BaseDialog.prototype.render.apply(this, arguments);
    return this;
  },

  _initModels: function() {
    this.columns = new Backbone.Collection();
    this.model = new cdb.core.Model({ page: 1, maxPages: 0 });
  },

  _initViews: function() {

    _.bindAll(this, "_onDescribeSuccess", "_addCard", "_generateThumbnail", "_analyzeColumn", "_analyzeColumns", "_refreshMapList", "_onLoadWizard");


    this.table = this.options.table;

    this._panes = new cdb.ui.common.TabPane({
      el: this.el
    });

    this.addView(this._panes);

    this._panes.addTab('vis',
      ViewFactory.createByTemplate('common/dialogs/pecan/template', {
      })
    );

    this._panes.addTab('loading',
      ViewFactory.createByTemplate('common/templates/loading', {
        title: 'Analyzing your data…',
        quote: randomQuote()
      })
    );

    this._panes.addTab('fail',
      ViewFactory.createByTemplate('common/templates/fail', {
        msg: 'Could not delete row for some reason'
      })
    );

    this._panes.active('loading');
    this._start();
  },

  _onSkipClick: function(e) {
    this.killEvent(e);
    this.close();
    this.trigger("skip", this);
  },

  _nextPage: function() {
    var page = this.model.get('page');
    var maxPages = this.model.get('maxPages');

    if (page < maxPages) {
      this.model.set('page', page + 1);
    }
  },

  _prevPage: function() {
    var page = this.model.get('page');
    if (page > 1) {
      this.model.set('page', page - 1);
    }
  },

  _moveTabsNavigation: function() {
    var page = this.model.get('page');
    var rowWidth = 990;

    var p = rowWidth * (page - 1);
    this.$('.js-map-list').css('margin-left', '-' + p + 'px');
    this._refreshNavigation();
  },

  _refreshNavigation: function() {
    var page = this.model.get('page');
    var maxPages = this.model.get('maxPages');

    this.$('.js-goPrev')[ page > 1 ? 'removeClass' : 'addClass' ]('is-disabled');
    this.$('.js-goNext')[ page < maxPages ? 'removeClass' : 'addClass' ]('is-disabled');
  },

  _initBinds: function() {
    this.model.bind('change:page', this._moveTabsNavigation, this);
    this.columns.bind('change', this._onChangeColumns, this);
    this._panes.bind('tabEnabled', this.render, this);
  },

  _onChangeColumns: function(column) {
    var analyzedColumns = this._getAnalyzedColumns();
    var succesColumns = this._getSuccessColumns();
    if (analyzedColumns.length == this.columns.length && succesColumns.length == 0) {
      this.close();
    }
  },

  _generateThumbnail: function(column, callback) {

    var template = this.options.map.getLayerAt(0).get("urlTemplate");

    var tiler_domain   = this.options.map.getLayerAt(1).get("tiler_domain");
    var tiler_port     = this.options.map.getLayerAt(1).get("tiler_port");
    var tiler_protocol = this.options.map.getLayerAt(1).get("tiler_protocol");

    //console.log(tiler_domain, tiler_port, tiler_protocol);

    var layer_definition = {
      user_name: user_data.username,
      tiler_domain: "localhost.lan",
      tiler_port: "8181",
      tiler_protocol: "http",
      layers: [{
        type: "http",
        options: {
          urlTemplate: template,
          subdomains: [ "a", "b", "c" ]
        }
      }, {
        type: "cartodb",
        options: {
          sql: column.get("sql"),
          cartocss: column.get("css"),
          cartocss_version: "2.1.1"
        }
      }]
    };

    cdb.Image(layer_definition).size(288, 170).zoom(this.options.map.get("zoom")).center(this.options.map.get("center")).getUrl(function(error, url) {
      callback && callback(error, url);
    });

  },

  _analyzeColumn: function(column) {

    var self = this;

    this.sql.describe(this.query, column.get("name"), function(stats) {

      var response = cdb.CartoCSS.guessMap(self.query,self.options.table.get("name"), column, stats);

      if (response) {
        column.set({ analyzed: true, success: true, sql: response.sql, css: response.css, wizard: response.wizard });
      } else {
        column.set({ analyzed: true, success: false });
      }

      if (response) {
        self._generateThumbnail(column, function(error, url) {
          if (!error) {
            self._addCard(url, response);
          }
        });
      }
    });
  },

  _addCard: function(url, response) {
    var self = this;

    this._panes.active('vis');

    var $el = $(cdb.templates.getTemplate('common/dialogs/pecan/card')({
      column: response.column,
      wizard: response.wizard,
      null_count: Utils.formatNumber(response.null_count),
      weight: response.stats.weight,
      src: url
    }));

    var img = new Image();

    img.onerror = function() {
      console.log("error");
    };

    img.onload  = function() {
      $el.find(".js-loader").hide();
      $el.find("img").show();
    };

    img.src = url;

    this.$(".js-map-list").append($el);

    $el.on("click", function(e) {
      self.killEvent(e);
      self._onCardClick(response);
    });

    this._refreshMapList($el);
    this._refreshNavigation();
  },

  _refreshMapList: function($el) {
    var w = $el.width();
    var l = this.$(".js-card").length;
    this.$(".js-map-list").width(w * l + (l - 1) * 30);
    this.model.set('maxPages', Math.ceil(this.$('.js-card').size() / this._TABS_PER_ROW));
  },

  _getAnalyzedColumns: function() {
    return this.columns.filter(function(c) { return c.get("analyzed")})
  },

  _getSuccessColumns: function() {
    return this.columns.filter(function(c) { return c.get("success")})
  },

  _start: function() {
    this.query = 'SELECT * FROM ' + this.table.id;
    this.sql = cdb.admin.SQL();
    this.sql.describe(this.query, 'the_geom', this._onDescribeSuccess);
  },

  _onDescribeSuccess: function(data) {

    if (!data) {
      this.close();
      return;
    }

    var self = this;

    var geometryType = data.simplified_geometry_type;

    this.sql.columns(this.query, function(columns) {

      _(columns).each(function(type, name) {
        this.columns.add({ name: name.concat(""), type: type, geometry_type: geometryType, bbox: data.bbox, analyzed: false })
      }, self);

      self._analyzeColumns();

    });

  },

  _onCardClick: function(response) {
    var dataLayers = this.options.map.layers.getDataLayers();
    this.layer = dataLayers[0];

    if (this.layer) {
      this.layer.wizard_properties.unbind("load", this._onLoadWizard);
      this.layer.wizard_properties.bind("load", function() {
        this._onLoadWizard(response);
      }, this);
      this.layer.wizard_properties.active(response.wizard, response.wizard_properties); 
    }

    this.close();
    //this.trigger("skip", this); // TODO: enable this after the manual testing is finished
  },

  _onLoadWizard: function(response) {
    this.layer.wizard_properties.set({ property: response.column, metadata: response.metadata })
  },

  _analyzeColumns: function() {
    this.columns.each(this._analyzeColumn);
  },

  _keydown: function(e) {
    if (e.keyCode === 37) {
      this._prevPage();
    } else if (e.keyCode === 39) {
      this._nextPage();
    }
    cdb.admin.BaseDialog.prototype._keydown.call(this, e);
  },

  clean: function() {
    if (this.layer) {
      this.layer.wizard_properties.unbind("load", this._onLoadWizard);
    }

    cdb.admin.BaseDialog.prototype.clean.call(this);
  }
});