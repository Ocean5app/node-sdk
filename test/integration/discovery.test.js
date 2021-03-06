'use strict';

const DiscoveryV1 = require('../../discovery/v1');
const authHelper = require('../resources/auth_helper.js');
const auth = authHelper.auth;
const describe = authHelper.describe; // this runs describe.skip if there is no auth.js file :)
const async = require('async');
const fs = require('fs');
const path = require('path');

const THIRTY_SECONDS = 30000;

describe('discovery_integration', function() {
  jest.setTimeout(THIRTY_SECONDS);

  const environment_id = auth.discovery.environment_id;
  const configuration_id = auth.discovery.configuration_id;
  const collection_id = auth.discovery.collection_id;
  const collection_id2 = auth.discovery.collection_id_2;
  const japanese_collection_id = auth.discovery.japanese_collection_id;

  const discovery = new DiscoveryV1(
    Object.assign({}, auth.discovery, {
      version: '2017-11-07',
    })
  );

  it('should getEnvironments()', function(done) {
    discovery.getEnvironments(null, function(err, res) {
      expect(err).toBeNull();
      expect(Array.isArray(res.environments)).toBe(true);
      const environment_ids = res.environments.map(e => e.environment_id);
      expect(environment_ids.indexOf(environment_id) > -1).toBe(true);
      done();
    });
  });

  it('should getEnvironment()', function(done) {
    discovery.getEnvironment({ environment_id: environment_id }, function(err, env) {
      expect(err).toBeNull();
      expect(env).toBeDefined();
      expect(env.environment_id).toBe(environment_id);
      done();
    });
  });

  it('should getConfigurations()', function(done) {
    discovery.getConfigurations({ environment_id: environment_id }, function(err, res) {
      expect(err).toBeNull();
      expect(Array.isArray(res.configurations)).toBeDefined();
      expect(res.configurations[0]).toBeDefined();
      done();
    });
  });

  it('should getConfiguration()', function(done) {
    discovery.getConfiguration(
      {
        environment_id: environment_id,
        configuration_id: configuration_id,
      },
      function(err, conf) {
        expect(err).toBeNull();
        expect(conf).toBeDefined();
        expect(conf.configuration_id).toBe(configuration_id);
        done();
      }
    );
  });

  // todo: delete the collection after the testing is complete
  it.skip('should createCollection()', function(done) {
    discovery.createCollection(
      {
        environment_id: environment_id,
        name: 'node-sdk-test-' + Date.now(),
        description:
          'Test collection created by the Node.js SDK integration tests on ' +
          new Date() +
          '. Should be deleted shortly',
        configuration_id: configuration_id,
        language_code: 'en_us',
      },
      function(err, res) {
        expect(err).toBeNull(); // Error: This operation is invalid for read-only environments. (?)
        // console.log(res);
        // todo: extract collection_id, use it in subsequent tests, delete it
        done(err, res);
      }
    );
  });

  it('getCollections()', function(done) {
    discovery.getCollections(
      {
        environment_id: environment_id,
        configuration_id: configuration_id,
      },
      function(err, res) {
        expect(err).toBeNull();
        expect(res).toBeDefined();
        // console.log(res);
        expect(Array.isArray(res.collections)).toBeDefined();
        done(err);
      }
    );
  });

  it('should perform a federated query for notices', function(done) {
    discovery.federatedQueryNotices(
      {
        environment_id: environment_id,
        configuration_id: configuration_id,
        collection_ids: [collection_id, collection_id2],
        filter: 'yesplease',
        count: 10,
        sort: ['+field_1', '-field_2'],
        natural_language_query: 'a question about stuff and things',
      },
      function(err, res) {
        expect(err).toBeNull();
        expect(res).toBeDefined();
        expect(Array.isArray(res.results)).toBeDefined();
        done(err);
      }
    );
  });

  describe('add-query-delete', function() {
    it('addDocument()', function(done) {
      const document_obj = {
        environment_id: environment_id,
        collection_id: collection_id,
        file: fs.createReadStream(path.join(__dirname, '../resources/sampleWord.docx')),
        filename: 'sampleWord.docx',
      };

      discovery.addDocument(document_obj, function(err, response) {
        expect(err).toBeNull();
        expect(response.document_id).toBeDefined();
        done(err);
      });
    });

    it('addJsonDocument()', function(done) {
      const document_obj = {
        environment_id: environment_id,
        collection_id: collection_id,
        file: {
          foo: 'bar',
          from: 'node-sdk integration test',
          test_date: new Date().toString(),
        },
      };

      discovery.addJsonDocument(document_obj, function(err, response) {
        expect(err).toBeNull();
        expect(response.document_id).toBeDefined();
        done(err);
      });
    });

    it('query()', function(done) {
      discovery.query(
        {
          environment_id: environment_id,
          collection_id: collection_id,
          query: '',
        },
        function(err, res) {
          expect(err).toBeNull();
          expect(res).toBeDefined();
          expect(typeof res.matching_results).toBe('number');
          expect(Array.isArray(res.results)).toBe(true);
          done(err);
        }
      );
    });

    it('delete all documents', function(done) {
      discovery.query(
        {
          environment_id: environment_id,
          collection_id: collection_id,
          query: '',
        },
        function(err, res) {
          expect(err).toBeNull();
          async.eachSeries(
            res.results,
            function(doc, next) {
              // console.log('deleting ', doc);
              discovery.deleteDocument(
                {
                  environment_id: environment_id,
                  collection_id: collection_id,
                  document_id: doc.id,
                },
                function(err, res) {
                  // console.log('deleted', err, res);
                  next(err);
                }
              );
            },
            done
          );
        }
      );
    });
  });

  describe('credentials tests @slow', function() {
    let credentialId;
    const sourceType = 'sharepoint';

    it('should createCredentials', function(done) {
      discovery.createCredentials(
        {
          environment_id,
          source_type: sourceType,
          credential_details: {
            credential_type: 'saml',
            username: 'myUserName',
            password: 'pass1234',
            organization_url: 'www.sharepoint-org.com/organization',
          },
        },
        function(err, res) {
          expect(err).toBeNull();
          expect(res.credential_id).toBeDefined();
          expect(res.source_type).toBe(sourceType);
          // save the credential id for later tests
          credentialId = res.credential_id;
          done();
        }
      );
    });

    it('should listCredentials', function(done) {
      discovery.listCredentials(
        {
          environment_id,
        },
        function(err, res) {
          expect(err).toBeNull();
          expect(Array.isArray(res.credentials)).toBe(true);
          done();
        }
      );
    });

    it('should updateCredentials', function(done) {
      discovery.updateCredentials(
        {
          environment_id,
          credential_id: credentialId,
          source_type: sourceType,
          credential_details: {
            credential_type: 'saml',
            username: 'myUserName',
            password: 'new!longer!password!123',
            organization_url: 'www.sharepoint-org.com/organization',
          },
        },
        function(err, res) {
          expect(err).toBeNull();
          expect(res.credential_id).toBe(credentialId);
          expect(res.source_type).toBe(sourceType);
          done();
        }
      );
    });

    it('should getCredentials', function(done) {
      discovery.getSourceCredentials(
        {
          environment_id,
          credential_id: credentialId,
        },
        function(err, res) {
          expect(err).toBeNull();
          expect(res.credential_id).toBe(credentialId);
          expect(res.source_type).toBe(sourceType);
          done();
        }
      );
    });

    it('should deleteCredentials', function(done) {
      discovery.deleteCredentials(
        {
          environment_id,
          credential_id: credentialId,
        },
        function(err, res) {
          expect(err).toBeNull();
          expect(res.credential_id).toBe(credentialId);
          expect(res.status).toBe('deleted');
          done();
        }
      );
    });
  });

  describe('events tests', function() {
    let document_id;
    let session_token;

    beforeAll(function(done) {
      const addDocParams = {
        environment_id,
        collection_id,
        file: fs.createReadStream(path.join(__dirname, '../resources/sampleWord.docx')),
      };

      discovery.addDocument(addDocParams, function(error, response) {
        if (error) done(error);
        document_id = response.document_id;

        const queryParams = {
          environment_id,
          collection_id,
          natural_language_query: 'jeopardy',
        };

        discovery.query(queryParams, function(err, res) {
          if (err) done(err);
          session_token = res.session_token;
          done();
        });
      });
    });

    it('should create event', function(done) {
      const type = 'click';
      const createEventParams = {
        type,
        data: {
          environment_id,
          session_token,
          collection_id,
          document_id,
        },
      };

      discovery.createEvent(createEventParams, function(err, res) {
        expect(err).toBeNull();
        expect(res.type).toBe(type);
        expect(res.data.environment_id).toBe(environment_id);
        expect(res.data.collection_id).toBe(collection_id);
        expect(res.data.document_id).toBe(document_id);
        expect(res.data.session_token).toBe(session_token);
        expect(res.data.result_type).toBeDefined();
        expect(res.data.query_id).toBeDefined();
        done();
      });
    });

    afterAll(function(done) {
      const params = {
        environment_id,
        collection_id,
        document_id,
      };
      discovery.deleteDocument(params, function(err, res) {
        done();
      });
    });
  });

  describe('metrics tests', function() {
    it('should get metrics event rate', function(done) {
      discovery.getMetricsEventRate(function(err, res) {
        expect(err).toBeNull();
        expect(res.aggregations).toBeDefined();
        expect(Array.isArray(res.aggregations)).toBe(true);
        expect(res.aggregations[0].results).toBeDefined();
        expect(Array.isArray(res.aggregations[0].results)).toBe(true);
        expect(res.aggregations[0].results[0].event_rate).toBeDefined();
        done();
      });
    });
    it('should get metrics query', function(done) {
      discovery.getMetricsQuery(function(err, res) {
        expect(err).toBeNull();
        expect(res.aggregations).toBeDefined();
        expect(Array.isArray(res.aggregations)).toBe(true);
        expect(res.aggregations[0].results).toBeDefined();
        expect(Array.isArray(res.aggregations[0].results)).toBe(true);
        expect(res.aggregations[0].results[0].matching_results).toBeDefined();
        done();
      });
    });
    it('should get metrics query event', function(done) {
      discovery.getMetricsQueryEvent(function(err, res) {
        expect(err).toBeNull();
        expect(res.aggregations).toBeDefined();
        expect(Array.isArray(res.aggregations)).toBe(true);
        expect(res.aggregations[0].results).toBeDefined();
        expect(Array.isArray(res.aggregations[0].results)).toBe(true);
        expect(res.aggregations[0].results[0].matching_results).toBeDefined();
        done();
      });
    });
    it('should get metrics query no results', function(done) {
      discovery.getMetricsQueryNoResults(function(err, res) {
        expect(err).toBeNull();
        expect(res.aggregations).toBeDefined();
        expect(Array.isArray(res.aggregations)).toBe(true);
        expect(res.aggregations[0].results).toBeDefined();
        expect(Array.isArray(res.aggregations[0].results)).toBe(true);
        expect(res.aggregations[0].results[0].matching_results).toBeDefined();
        done();
      });
    });
    it('should get metrics query token event', function(done) {
      const count = 2;
      const params = { count };
      discovery.getMetricsQueryTokenEvent(params, function(err, res) {
        expect(err).toBeNull();
        expect(res.aggregations).toBeDefined();
        expect(Array.isArray(res.aggregations)).toBe(true);
        expect(res.aggregations[0].results).toBeDefined();
        expect(Array.isArray(res.aggregations[0].results)).toBe(true);
        expect(res.aggregations[0].results.length).toBe(count);
        expect(res.aggregations[0].results[0].event_rate).toBeDefined();
        done();
      });
    });
  });

  describe('logs tests', function() {
    it('should query log', function(done) {
      const count = 2;
      const filter = 'stuff';
      const params = {
        count,
        offset: 1,
        filter,
        sort: ['created_timestamp'],
      };
      discovery.queryLog(params, function(err, res) {
        expect(err).toBeNull();
        expect(res.matching_results).toBeDefined();
        expect(res.results).toBeDefined();
        expect(Array.isArray(res.results)).toBeDefined();
        expect(res.results.length).toBe(count);
        expect(res.results[0].natural_language_query.indexOf(filter)).not.toBe(-1);
        done();
      });
    });
  });

  describe('tokenization dictionary tests @slow', function() {
    it('should createTokenizationDictionary', function(done) {
      const params = {
        environment_id,
        collection_id: japanese_collection_id,
        tokenization_rules: [
          {
            text: 'すしネコ',
            tokens: ['すし', 'ネコ'],
            readings: ['寿司', 'ネコ'],
            part_of_speech: 'カスタム名詞',
          },
        ],
      };

      discovery.createTokenizationDictionary(params, (err, res) => {
        expect(err).toBeNull();
        expect(res.status).toBeDefined();
        expect(res.type).toBeDefined();
        done();
      });
    });

    it('should getTokenizationDictionaryStatus', function(done) {
      const params = {
        environment_id,
        collection_id: japanese_collection_id,
      };

      discovery.getTokenizationDictionaryStatus(params, (err, res) => {
        expect(err).toBeNull();
        expect(res.status).toBeDefined();
        expect(res.type).toBeDefined();
        done();
      });
    });

    it('should deleteTokenizationDictionary', function(done) {
      const params = {
        environment_id,
        collection_id: japanese_collection_id,
      };

      discovery.deleteTokenizationDictionary(params, (err, res) => {
        expect(err).toBeNull();
        expect(res).toBe('');
        done();
      });
    });
  });
});
