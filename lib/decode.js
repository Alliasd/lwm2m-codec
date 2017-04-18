'use strict';

var _ = require('busyman'),
    DChunks = require('dissolve-chunks');

var cutils = require('./cutils');

function decode(type, path, value) {
    if (path && !value) {
        value = path;
        path = null;
    }

    switch (type) {
        case 'link':
            if (_.isString(value))
                return decodeLink(value);
            return false;

        case 'tlv':
            return decodeTlv(value);

        case 'json':
            if (_.isPlainObject(value) && value.e)
                return decodeJson(path, value);
            return false;

        default:
            break;
    }
}

/*********************************************************
 * Link-format                                           *
 *********************************************************/
function decodeLink(value) {                                // '</1/2>;pmin=10;pmax=60,</1/2/1>,</1/2/2>'
    var allowedAttrs = [ 'pmin', 'pmax', 'gt', 'lt', 'st' ],
        valueArray = value.split(','),                      // ['</1/2>;pmin=10;pmax=60', '</1/2/1>', '</1/2/2>']
        resrcArray = valueArray.slice(1),                   // ['</1/2/1>', '</1/2/2>']
        attrsArray = valueArray[0].split(';').slice(1),     // ['pmin=10', 'pmax=60']
        path = valueArray[0].split(';')[0].slice(1, -1),
        data = {
            path: path
        },
        rid;    

    if (!_.isEmpty(attrsArray)) {
        data.attrs = {};
        _.forEach(attrsArray, function (val) {
            var attr = val.split('=');

            if (_.includes(allowedAttrs, attr[0]))
                data.attrs[attr[0]] = Number(attr[1]);
        });
    }

    if (!_.isEmpty(resrcArray)) {
        data.resrcList = [];
        _.forEach(resrcArray, function (resrc, idx) {     
            data.resrcList.push(resrc.slice(1, -1));  
        });
    }

    return data;     // { path: '/1/2', attrs: { pmin: 10, pmax: 60 }, resrcList: ['/1/2/1', '/1/2/2'] }
}

/*********************************************************
 * Tlv                                                   *
 *********************************************************/
function decodeTlv(value) {

}


/*********************************************************
 * Json                                                  *
 *********************************************************/
function decodeJson(basePath, value) {
    var data = {},
        path = basePath || value.bn,       // bn is optional, so we need basePath to check type
        pathType = cutils.getPathDateType(path),
        oid = cutils.getPathIdKey(path).oid,
        rid;

    switch (pathType) {
        case 'object':         // obj
            _.forEach(value.e, function (resrc) {
                var pathArray = cutils.getPathArray(resrc.n),          // [iid, rid[, riid]]
                    val;

                if (!_.isUndefined(resrc.v)) {
                    val = resrc.v;
                } else if (!_.isUndefined(resrc.sv)) {
                    val = resrc.sv;
                } else if (!_.isUndefined(resrc.bv)) {
                    val = resrc.bv;
                } else if (!_.isUndefined(resrc.ov)) {
                    val = resrc.ov;     // [TODO] objlnk
                }

                if (pathArray[0] === '')
                    pathArray = pathArray.slice(1);

                if (pathArray[pathArray.length - 1] === '')
                    pathArray = pathArray.slice(0, pathArray.length - 1);

                if (pathArray[0] && !_.has(data, pathArray[0]))
                    data[pathArray[0]] = {};

                rid = cutils.ridKey(oid, pathArray[1]);

                if (rid && !_.has(data, [pathArray[0], rid])) {
                    if (pathArray[2]) {
                        data[pathArray[0]][rid] = {};
                        data[pathArray[0]][rid][pathArray[2]] = val;
                    } else {
                        data[pathArray[0]][rid] = val;
                    }
                }
            });
            break;

        case 'instance':         // inst
            _.forEach(value.e, function (resrc) {
                var pathArray = cutils.getPathArray(resrc.n),          // [rid[, riid]]
                    val;

                if (!_.isUndefined(resrc.v)) {
                    val = resrc.v;
                } else if (!_.isUndefined(resrc.sv)) {
                    val = resrc.sv;
                } else if (!_.isUndefined(resrc.bv)) {
                    val = resrc.bv;
                } else if (!_.isUndefined(resrc.ov)) {
                    val = resrc.ov;     // [TODO] objlnk
                }

                if (pathArray[0] === '')
                    pathArray = pathArray.slice(1);

                if (pathArray[pathArray.length - 1] === '')
                    pathArray = pathArray.slice(0, pathArray.length - 1);

                rid = cutils.ridKey(oid, pathArray[0]);

                if (rid && !_.has(data, rid)) {
                    if (pathArray[1]) {
                        data[rid] = {};
                        data[rid][pathArray[1]] = val;
                    } else {
                        data[rid] = val;
                    }
                }
            });
            break;

        case 'resource':         // resrc
            _.forEach(value.e, function (resrc) {
                var riid = resrc.n,          // [[riid]]
                    isMultiResrc = false,
                    val;

                if (riid)
                    isMultiResrc = true;

                if (!_.isUndefined(resrc.v)) {
                    val = resrc.v;
                } else if (!_.isUndefined(resrc.sv)) {
                    val = resrc.sv;
                } else if (!_.isUndefined(resrc.bv)) {
                    val = resrc.bv;
                } else if (!_.isUndefined(resrc.ov)) {
                    val = resrc.ov;     // [TODO] objlnk
                }

                if (!isMultiResrc) {
                    data = val;
                } else if (isMultiResrc && !_.has(data, riid)) {
                    data[riid] = val;
                }
            });
            break;

        default:
            break;
     }
    
    return data;
}

/*********************************************************
 * Module Exports                                        *
 *********************************************************/
module.exports = decode;