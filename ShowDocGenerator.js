var Mustache = require('./mustache')
// legacy, import the mustache.js script (to Paw 2.2.2)
// require("mustache.js");

let ExportApiToShowDoc = function () {
  this.generate = function (context, requests, options) {
    var generated = "";
    // import the mustache template
    var template = readFile("my-template.mustache");
    // iterate requests (`Request` objects)
    for (var i in requests) {
      var request = requests[i];
      // define your view
      var view = {
        "description": request.description ? request.description : request.name,
        "headers": [],
        "url": convertEnvString(request.getUrlBase(true), context),
        "method": request.getMethod(),
        "parameters": [],
        "request": request,
        "response": '',
        "responseParam": ''
      };

      // iterate on request headers
      // var content_type = request.getHeaderByName('Content-Type')
      var headers = request.getHeaders();
      for (var header_name in headers) {
        view.headers.push({
          key: header_name,
          value: headers[header_name]
        })
      }

      // parameters
      if (request.getMethod() == 'GET') {
        var parameters = request.getUrlParameters(true);
        view.parameters = convertQueryParam(parameters, request);
      } else if (request.getMethod() == 'POST') {
        var body = convertBody(request, context)[0];
        if (body) {
          view.parameters = body[body.mode]
          if (request.getHeaderByName("Content-Type") && request.getHeaderByName("Content-Type").indexOf('application/json') >= 0) {
            const jsonObj = JSON.parse(body[body.mode])
            var jsonData = []
            for(var key in jsonObj){
              jsonData.push({
                key: key,
                value: jsonObj[key],
                required: true,
                description: jsonObj[key]
              })
            }
            view.parameters = jsonData
          }
        }
      }
      if(view.parameters){
        view.parameters.map(v => {
          v['type'] = typeof(v.value)
        })
      }


      // get the latest response status code
      if (request.getLastExchange()) {
        var status_code = request.getLastExchange().responseStatusCode;
        // get the latest response body
        if (status_code == 200) {
          var body = request.getLastExchange().responseBody;
          // generated += status_code + "\n" + body + "\n\n";
          view.response = jsonFormat(body);
          view.responseParam = oJsonToParam(JSON.parse(body), '', '');
        }
      }

      // render the template
      if (requests.length > 1) {
        generated += `## ${i*1 + 1}. ${request.name}\n\n`
      }
      generated += Mustache.render(template, view) + "\n\n";
    }
    return generated;
  }
}


ExportApiToShowDoc.identifier = "com.Ken.ShowDocGenerator";
ExportApiToShowDoc.title = "Export API to ShowDoc";
ExportApiToShowDoc.fileExtension = "md";
ExportApiToShowDoc.languageHighlighter = "markdown";


registerCodeGenerator(ExportApiToShowDoc);


function jsonFormat(sJson) {
  let oJson = JSON.parse(sJson);
  return JSON.stringify(oJson, null, "  ");
}

function getObjAttr(obj) {
  var keys = Object.keys(obj);
  console.log(keys);
  for (var i = 0; i < keys.length; i++) {
    console.log(keys[i] + " => " + obj[keys[i]])
  }
}


//-----------------------------
function convertQueryParam(parameters, request) {
  // var data = {
  //   key: '',
  //   required: '',
  //   description: '',
  //   value: ''
  // };
  var data = [];

  for (var parameters_name in parameters) {
    var components = parameters[parameters_name].components;
    if (components[0] !== undefined) {
      if (components[0].type == 'com.luckymarmot.RequestVariableDynamicValue') {
        var tmp = request.getVariableById(parameters[parameters_name].components[0].variableUUID);
        data.push({
          key: tmp.name,
          required: tmp.required,
          description: tmp.description,
          value: tmp.value.components[0] ? tmp.value.components[0] : '-',
        })
      } else {
        data.push({
          key: parameters_name,
          required: false,
          description: '-',
          value: components[0],
        })
      }
    } else {
      data.push({
        key: parameters_name,
        required: false,
        description: '-',
        value: '-',
      })
    }
  }

  return data;
}


//---------------------------------
function oJsonToParam(oJson, str, separator) {
  if (isArrayFn(oJson)) {
    var tmp = oJson[0];
    if (tmp && typeof tmp == 'object') {
      for (var k in tmp) {
        str += '| ' + separator + k + ' | string | - |\n';
      }
    } else {
      str += '| ' + separator + '0' + ' | string | - |\n';
    }
  } else if (oJson instanceof Object) {
    for (var k in oJson) {
      if (typeof oJson[k] == 'object') {
        str += '| ' + separator + k + ' | object | - |\n';
        str = oJsonToParam(oJson[k], str, separator + '- ')
      } else {
        str += '| ' + separator + k + ' | string | - |\n';
      }
    }
  }
  return str;
}

function isArrayFn(value) {
  if (typeof Array.isArray === "function") {
    return Array.isArray(value);
  } else {
    return Object.prototype.toString.call(value) === "[object Array]";
  }
}

var convertEnvByType = function convertEnvByType(dynamicString, request, type) {
  if (!dynamicString) {
    return '';
  }

  return dynamicString.components.map(function (component) {
    if (typeof component === 'string') {
      return component;
    }

    if (component.type === 'com.luckymarmot.EnvironmentVariableDynamicValue') {
      var envVarId = component.environmentVariable;
      var envVar = context.getEnvironmentVariableById(envVarId);

      if (envVar) {
        return "{{".concat(envVar.name, "}}");
      }
    } else if (component.type == 'com.luckymarmot.RequestVariableDynamicValue' && type) {
      var tmp = request.getVariableById(component.variableUUID);
      // console.log('=====')
      // console.log(tmp)
      // console.log(type)
      getObjAttr(tmp)
      return tmp[type] ? tmp[type] : ''
    } else {
      return null;
    }

    // return component.getEvaluatedString();
  }).join('');
};


//-----------------------------------
var convertEnvString = function convertEnvString(dynamicString, context) {
  if (!dynamicString) {
    return '';
  }

  return dynamicString.components.map(function (component) {
    if (typeof component === 'string') {
      return component;
    }

    if (component.type === 'com.luckymarmot.EnvironmentVariableDynamicValue') {
      var envVarId = component.environmentVariable;
      var envVar = context.getEnvironmentVariableById(envVarId);

      if (envVar) {
        return "{{".concat(envVar.name, "}}");
      }
    }

    return component.getEvaluatedString();
  }).join('');
};

var convertUrlBaseEnvString = function convertUrlBaseEnvString(urlString) {
  if (!urlString) {
    return {
      protocol: null,
      host: [''],
      port: null,
      path: null
    };
  } // parse URL string


  var match = urlString.match(/^([^:]+):\/\/([^:/]+)(?::([0-9]*))?(?:(\/.*))?$/i);

  if (!match) {
    return {
      protocol: null,
      host: [urlString],
      port: null,
      path: null
    };
  } // split host


  var host = [];

  if (match[2]) {
    host = match[2].split('.');
  } // split path


  var path = [];

  if (match[4]) {
    path = match[4].split('/').filter(function (component) {
      return !!component;
    });
  }

  return {
    protocol: match[1] || null,
    host: host,
    port: match[3] || null,
    path: path
  };
};


//----------------
var makeContentTypeHeader = function makeContentTypeHeader(contentType) {
  var pmHeader = {
    key: 'Content-Type',
    value: contentType,
    required: false,
    description: '-'
  };
  return [pmHeader];
};

var convertRaw = function convertRaw(dynamicString, onlyDynamicValue, context) {
  // make header
  var pmHeaders = [];

  if (onlyDynamicValue && onlyDynamicValue.type === 'com.luckymarmot.JSONDynamicValue') {
    pmHeaders = makeContentTypeHeader('application/json');
  } // make body


  var value = convertEnvString(dynamicString, context);
  var pmBody = {
    mode: 'raw',
    required: false,
    raw: value
  };
  return [pmBody, pmHeaders];
};

var convertBodyUrlEncoded = function convertBodyUrlEncoded(pawUrlEncodedBody, context, request) {
  var pmParams = Object.entries(pawUrlEncodedBody).map(function (_ref) {
    var _ref2 = src_slicedToArray(_ref, 2),
      key = _ref2[0],
      value = _ref2[1];

    var pmParam = {
      key: key || '',
      value: convertEnvString(value, context),
      required: convertEnvByType(value, request, 'required') ? true : false,
      description: convertEnvByType(value, request, 'description')
    };
    return pmParam;
  });
  var pmBody = {
    mode: 'urlencoded',
    required: false,
    urlencoded: pmParams
  };
  return [pmBody, makeContentTypeHeader('application/x-www-form-urlencoded')];
};

var convertBodyMultipart = function convertBodyMultipart(pawMultipartBody, context, request) {
  var pmParams = Object.entries(pawMultipartBody).map(function (_ref3) {
    var _ref4 = src_slicedToArray(_ref3, 2),
      key = _ref4[0],
      value = _ref4[1];

    // file
    var valueOnlyDv = value ? value.getOnlyDynamicValue() : null;

    if (valueOnlyDv && valueOnlyDv.type === 'com.luckymarmot.FileContentDynamicValue') {
      var _pmParam = {
        key: key || '',
        required: convertEnvByType(value, request, 'required') ? true : false,
        type: 'file',
        description: convertEnvByType(value, request, 'description'),
        src: null
      };
      return _pmParam;
    } // string/text


    var pmParam = {
      key: key || '',
      value: convertEnvString(value, context),
      required: false,
      type: 'text',
      description: '-'
    };
    return pmParam;
  });
  var pmBody = {
    mode: 'formdata',
    required: false,
    formdata: pmParams
  };
  return [pmBody, makeContentTypeHeader('multipart/form-data')];
};

var convertBodyFile = function convertBodyFile(pawRequest) {
  var pmBodyFile = {
    src: null,
    content: pawRequest.body || null
  };
  var pmBody = {
    mode: 'file',
    required: false,
    file: pmBodyFile
  };
  return [pmBody, []];
};

var convertBody = function convertBody(pawRequest, context) {
  // URL-Encoded (urlencoded)
  var pawUrlEncodedBody = pawRequest.getUrlEncodedBody(true);

  if (pawUrlEncodedBody) {
    return convertBodyUrlEncoded(pawUrlEncodedBody, context, pawRequest);
  } // Multipart (formdata)


  var pawMultipartBody = pawRequest.getMultipartBody(true);

  if (pawMultipartBody) {
    return convertBodyMultipart(pawMultipartBody, context, pawRequest);
  } // Body as DV


  var pawBody = pawRequest.getBody(true);

  if (!pawBody) {
    return [null, []];
  }

  var pawBodyDv = pawBody.getOnlyDynamicValue(); // File

  if (pawBodyDv && pawBodyDv.type === 'com.luckymarmot.FileContentDynamicValue') {
    return convertBodyFile(pawRequest);
  } // Raw


  return convertRaw(pawBody, pawBodyDv, context);
};


//--------------------------
function src_slicedToArray(arr, i) { return src_arrayWithHoles(arr) || src_iterableToArrayLimit(arr, i) || src_nonIterableRest(); }
function src_nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }
function src_iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }
function src_arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }
