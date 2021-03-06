var ConfigModel = require('../../../../javascripts/cartodb3/data/config-model');
var LayerDefinitionModel = require('../../../../javascripts/cartodb3/data/layer-definition-model');

describe('data/layer-definition-model', function () {
  beforeEach(function () {
    this.configModel = new ConfigModel({
      base_url: '/u/pepe'
    });

    this.model = new LayerDefinitionModel({
      id: 'abc-123',
      options: {
        type: 'CartoDB',
        table_name: 'foo'
      }
    }, {
      parse: true,
      configModel: this.configModel
    });
  });

  describe('.toJSON', function () {
    it('should return the original data', function () {
      expect(this.model.toJSON()).toEqual({
        id: 'abc-123',
        options: {
          type: 'CartoDB',
          table_name: 'foo',
          query: undefined
        }
      });
    });
  });

  describe('for a tile layer', function () {
    beforeEach(function () {
      this.model = new LayerDefinitionModel({
        id: 'abc-123',
        options: {
          type: 'Tiled'
        }
      }, {
        parse: true,
        configModel: this.configModel
      });
    });

    it('should not have any data models', function () {
      expect(this.model.layerTableModel).toBeUndefined();
    });
  });

  describe('for a cartodb layer', function () {
    beforeEach(function () {
      this.model = new LayerDefinitionModel({
        id: 'abc-123',
        options: {
          type: 'CartoDB',
          table_name: 'foo_table',
          query: 'SELECT * FROM pepe.foo_table'
        }
      }, {
        parse: true,
        configModel: this.configModel
      });
    });

    it('should have a layer table model', function () {
      var m = this.model.layerTableModel;
      expect(m).toBeDefined();
      expect(m.get('table_name')).toContain('foo_table');
      expect(m.get('query')).toContain('SELECT');
    });
  });

  describe('for a namedmap layer', function () {
    beforeEach(function () {
      this.model = new LayerDefinitionModel({
        id: 'abc-123',
        options: {
          type: 'CartoDB',
          table_name: 'foo_table',
          query: 'SELECT * FROM pepe.foo_table',
          id: 'XOXO-999'
        }
      }, {
        parse: true,
        configModel: this.configModel
      });
    });

    it('should maintain its own id', function () {
      expect(this.model.id).toEqual('abc-123');
    });

    it('should have a layer table model', function () {
      var m = this.model.layerTableModel;
      expect(m).toBeDefined();
      expect(m.get('table_name')).toContain('foo_table');
      expect(m.get('query')).toContain('SELECT');
    });
  });

  describe('for a layer with a analysis source', function () {
    beforeEach(function () {
      this.model = new LayerDefinitionModel({
        id: 'abc-123',
        options: {
          type: 'CartoDB',
          table_name: 'foo_table',
          source: 'a1'
        }
      }, {
        parse: true,
        configModel: this.configModel
      });
    });

    it('should have a source set', function () {
      expect(this.model.get('source')).toEqual('a1');
    });

    describe('.toJSON', function () {
      it('should return the original data', function () {
        expect(this.model.toJSON()).toEqual({
          id: 'abc-123',
          options: {
            type: 'CartoDB',
            table_name: 'foo_table',
            query: undefined,
            source: 'a1'
          }
        });
      });
    });
  });
});
