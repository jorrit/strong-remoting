// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: strong-remoting
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

var assert = require('assert');
var HttpInvocation = require('../lib/http-invocation');
var SharedMethod = require('../lib/shared-method');
var Dynamic = require('../lib/dynamic');
var extend = require('util')._extend;
var expect = require('chai').expect;

describe('HttpInvocation', function() {
  describe('namedArgs', function() {
    function expectNamedArgs(accepts, inputArgs, expectedNamedArgs) {
      var method = givenSharedStaticMethod({
        accepts: accepts,
      });
      var inv = new HttpInvocation(method, null, inputArgs);
      expect(inv.namedArgs).to.deep.equal(expectedNamedArgs);
    }

    it('should correctly name a single arg', function() {
      expectNamedArgs(
        [{ arg: 'a', type: 'number' }],
        [1],
        { a: 1 }
      );
    });

    it('should correctly name multiple args', function() {
      expectNamedArgs(
        [{ arg: 'a', type: 'number' }, { arg: 'str', type: 'string' }],
        [1, 'foo'],
        { a: 1, str: 'foo' }
      );
    });

    it('should correctly name multiple args when a partial set is provided', function() {
      expectNamedArgs(
        [{ arg: 'a', type: 'number' }, { arg: 'str', type: 'string' }],
        [1],
        { a: 1 }
      );
    });

    describe('HttpContext.isAcceptable()', function() {
      it('should accept an acceptable argument', function() {
        var acceptable = HttpInvocation.isAcceptable(2, {
          arg: 'foo',
          type: 'number',
        });
        expect(acceptable).to.equal(true);
      });

      it('should always accept args when type is any', function() {
        var acceptable = HttpInvocation.isAcceptable(2, {
          arg: 'bar',
          type: 'any',
        });
        expect(acceptable).to.equal(true);
      });

      it('should always accept args when type is complex', function() {
        var acceptable = HttpInvocation.isAcceptable({}, {
          arg: 'bar',
          type: 'MyComplexType',
        });
        expect(acceptable).to.equal(true);
      });

      it('should accept null arg when type is complex', function() {
        var acceptable = HttpInvocation.isAcceptable(null, {
          arg: 'bar',
          type: 'MyComplexType',
        });
        expect(acceptable).to.equal(true);
      });
    });
  });
  function setupReturnTypes(returns, converterName, converter, res, cb) {
    var method = givenSharedStaticMethod({ returns: returns });
    var inv = new HttpInvocation(method);
    var body = res.body || {};

    Dynamic.define(converterName, converter);
    inv.transformResponse(res, body, cb);
  }

  describe('transformResponse', function() {
    it('should return a single instance of TestClass', function(done) {
      setupReturnTypes({
        arg: 'data',
        type: 'bar',
        root: true,
      }, 'bar', function(data) {
        return data ? new TestClass(data) : data;
      }, {
        body: { foo: 'bar' },
      }, function(err, inst) {
        expect(err).to.be.null;
        expect(inst).to.be.instanceOf(TestClass);
        expect(inst.foo).to.equal('bar');
        done();
      });

      function TestClass(data) {
        this.foo = data.foo;
      }
    });

    it('should return an array of TestClass instances', function(done) {
      setupReturnTypes({
        arg: 'data',
        type: ['bar'],
        root: true,
      }, 'bar', function(data) {
        return data ? new TestClass(data) : data;
      }, {
        body: [
          { foo: 'bar' },
          { foo: 'grok' },
        ],
      }, function(err, insts) {
        expect(err).to.be.null;
        expect(insts).to.be.an('array');
        expect(insts[0]).to.be.instanceOf(TestClass);
        expect(insts[1]).to.be.instanceOf(TestClass);
        expect(insts[0].foo).to.equal('bar');
        expect(insts[1].foo).to.equal('grok');
        done();
      });

      function TestClass(data) {
        this.foo = data.foo;
      }
    });

    it('should forward all error properties', function(done) {
      var method = givenSharedStaticMethod({});
      var inv = new HttpInvocation(method);
      var res = {
        statusCode: 555,
        body: {
          error: {
            name: 'CustomError',
            message: 'Custom error message',
            statusCode: 555,
            details: {
              key: 'value',
            },
            extra: 'extra value',
          },
        },
      };

      inv.transformResponse(res, res.body, function(err) {
        if (!err)
          return done(new Error('transformResponse should have failed.'));

        expect(err).to.have.property('name', 'CustomError');
        expect(err).to.have.property('message', 'Custom error message');
        expect(err).to.have.property('statusCode', 555);
        expect(err).to.have.property('details').eql({ key: 'value' });
        expect(err).to.have.property('extra', 'extra value');
        done();
      });
    });

    it('should forward statusCode and non-object error response', function(done) {
      var method = givenSharedStaticMethod({});
      var inv = new HttpInvocation(method);
      var res = {
        statusCode: 555,
        body: 'error body',
      };

      inv.transformResponse(res, res.body, function(err) {
        if (!err)
          return done(new Error('transformResponse should have failed.'));

        expect(err).to.have.property('statusCode', 555);
        expect(err).to.have.property('details', 'error body');
        done();
      });
    });
  });
});

function givenSharedStaticMethod(fn, config) {
  if (typeof fn === 'object' && config === undefined) {
    config = fn;
    fn = null;
  }
  fn = fn || function(cb) { cb(); };

  var testClass = { testMethod: fn };
  config = extend({ shared: true }, config);
  extend(testClass.testMethod, config);
  return SharedMethod.fromFunction(fn, 'testStaticMethodName', null, true);
}
