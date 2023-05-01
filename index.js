const fs = require('fs');
const path = require('path');

const stringList = {
  string_server: 'server',
  string_db: 'db',
  string_entity: 'entity',
  string_db_name: 'db.sqlite',

  // 'util.xxx.js'
  filename_util_xxx_js: 'util.orm.js',
  // 'db.js'
  filename_db_js: 'db.js',
};

/**
 * create an array, save text
 * @param pathTarget
 * @param callback
 * @returns {*}
 */
function handleTextArr(pathTarget, callback) {
  const textArr = [];

  const filenameList = fs.readdirSync(pathTarget);
  filenameList.forEach((filename) => {
    const text = callback(filename);
    if (Array.isArray(text)) {
      Array.from(text).forEach((value) => {
        textArr.push(value);
      });
    }
    else {
      textArr.push(text);
    }
  });

  const reduce = textArr.reduce((str, value) => {
    return str.concat(value);
  }, '');
  return reduce;
}

/**
 * find dir/ level up
 *
 * eg: xxx-project/server/router/
 *
 * return xxx-project/server/
 *
 * @param pathTarget
 * @param filename
 * @returns
 */
function getPathByLevelUp(
  pathTarget = null,
  filename = null) {

  if (pathTarget === null) {
    return;
  }

  const basename = path.basename(pathTarget);
  const pathLevelUp = pathTarget.replace(basename, '');
  if (filename === null) {
    return pathLevelUp;
  }
  else {
    return path.join(pathLevelUp, filename);
  }
}

function convertType(dbtype) {
  const typeObj = {
    varchar: 'string',
    text: 'string',
    boolean: 'boolean',
    int: 'number',
  };
  return typeObj[dbtype];
}

function convertEntity(entityObj) {
  let o = entityObj.columns;
  let ret = [];
  ret.push('{');
  Object.keys(o).forEach((key_) => {
    let val = o[String(key_)];
    let jstype = convertType(val.type);
    let arr = [`${key_}?`, ':', ' ', jstype, ',', ' '];
    ret.push(...arr);
  });
  ret.push('}');
  let reduce = ret.reduce((str, value) => {
    return str.concat(value);
  }, '');

  return reduce;
}

function convertEntityToResultType(entityObj) {
  let {key_: find, value_} = findPrimaryKey(entityObj);

  let o = entityObj.columns;
  let ret = [];
  ret.push('{');
  delete entityObj.columns[find];
  let dbtype = value_['type'];

  console.log(`meslog dbtype=\n`, dbtype);

  let arrPk = [`${find}?`, ':', ' ', convertType(dbtype), ',', ' '];
  ret.push(...arrPk);

  Object.keys(o).forEach((key_) => {
    let val = o[String(key_)];
    let jstype = convertType(val.type);
    let arr = [key_, ':', ' ', jstype, ',', ' '];
    ret.push(...arr);
  });
  entityObj.columns[find] = value_;
  ret.push('}');
  let reduce = ret.reduce((str, value) => {
    return str.concat(value);
  }, '');

  // console.log(`meslog reduce=\n`, reduce);

  return reduce;
}

/**
 * gene util.typeorm.js file
 * @param pathDirEntity
 * @param pathDirGeneFile
 */
function geneUtilDexieJs(
  pathDirEntity = null,
  pathDirGeneFile = null,
) {
  if (pathDirEntity === null || pathDirGeneFile === null) {
    return;
  }

  const reduce = handleTextArr(pathDirEntity, (filename) => {
    const requirePath = path.join(pathDirEntity, filename);
    const entityObj = structuredClone(require(requirePath));

    let {key_, value_} = findPrimaryKey(entityObj);
    const entityName = entityObj.name;
    const entityInsertString = convertEntityToResultType(entityObj);
    const entityUpdateString = convertEntity(entityObj);

    const dbTableString = `await db.${entityName}s.`;

    const line =
      `
  // ${entityName}.entity.js
  // **************************************************************************
  /**
   * ({ id:1, name: 'mary'}); // &id
   *
   * ({ name: 'mary'}); // ++id
   *
   * insert ${entityName}
   * @param entityObj {Object:${entityUpdateString}}
   * @returns {Promise<void>}
   */
  ${entityName}Insert: async (entityObj) => {
    ${dbTableString}add(entityObj);
  },
  /**
   * ({id:1});
   * @param options {Object:${entityUpdateString}}
   * @returns {Promise<boolean>}
   */
  ${entityName}Delete: async (options) => {
    let find = ${dbTableString}get(options)
    if(find){
      let primaryKeyValue = find['${key_}']
      return ${dbTableString}delete(primaryKeyValue);
    }else{
      return true
    }
  },
  /**
   * ({name: 'jessica'}, {id: 1})
   * @param ${entityName}New {Object:${entityUpdateString}}
   * @param options {Object:${entityUpdateString}}
   */
  ${entityName}Update: async (${entityName}New, options) => {
    let find = ${dbTableString}get(options)
    let primaryKeyValue = find['${key_}']
    ${dbTableString}update(primaryKeyValue, ${entityName}New)
  },
  /**
   * ({color: 'yellow'});// update all color='yellow'
   * @param options {Object:${entityUpdateString}}
   * @returns {Promise<void>}
   */
  ${entityName}UpdateAll: async (options) => {
    ${dbTableString}toCollection().modify((${entityName}) => {
      ${entityName} = Object.assign(${entityName}, options);
    });
  },
  /**
   * {id: 1}
   * @param options {Object:${entityUpdateString}}
   * @returns {Promise<null|${entityInsertString}>}
   */
  ${entityName}FindOneWhere: async (options) => {
    let ret = ${dbTableString}get(options)
    return ret ? ret : null
  },
  /**
   * find all ${entityName}
   * @returns {Promise<[${entityInsertString}]>}
   */
  ${entityName}Find: async () => {
    return ${dbTableString}toArray()
  },
  /**
   * {id: 1}
   * @param options {Object:${entityUpdateString}}
   * @returns {Promise<[${entityInsertString}]>}
   */
  ${entityName}FindWhere: async (options) => {
    const searchKey = String(Object.keys(options)[0]);
    const searchVal = String(Object.values(options)[0]);
    return ${dbTableString}where(searchKey).equals(searchVal).toArray()
  },
  /**
   * {id: 1}
   * @param options {Object:${entityUpdateString}}
   * @returns {Promise<number>}
   */
  ${entityName}Count: async (options) => {
    const searchKey = String(Object.keys(options)[0]);
    const searchVal = String(Object.values(options)[0]);
    return ${dbTableString}where(searchKey).equals(searchVal).count()
  },
  /**
   * {name: 'mari'} to {name: Like('%mari%')}
   * @param options {Object:${entityUpdateString}}
   * @returns {Promise<[${entityInsertString}]>}
   */
  ${entityName}FindWhereLike: async (options) => {
    const searchKey = String(Object.keys(options)[0]);
    const searchVal = String(Object.values(options)[0]);
    return ${dbTableString}filter((config) =>
      config[searchKey].includes(searchVal),
    ).toArray()
  },

`;

    return line;
  });

  const text =
    `'use strict';

import {db} from './db.js'

const table = {
  ${reduce}
}

export {
  table
}
`;

  const file = path.join(pathDirGeneFile, stringList.filename_util_xxx_js);
  fs.writeFileSync(file, text);
  // console.log(`file=\n`, file, `\n`);
  // console.log(`text=\n`, text, `\n`);
}

/**
 *
 * @param entityObj
 * @returns {{key_: string, value_: String}}
 */
function findPrimaryKey(entityObj) {
  let find = Object.keys(entityObj.columns)
    .find((key_) => {
      let value_ = entityObj.columns[key_];
      if (value_.hasOwnProperty('primary')) {
        let primaryVal = value_.primary;
        if (primaryVal === true) {
          return key_;
        }
      }
    });
  let val = entityObj.columns[find];
  return {key_: find, value_: val};
}

function getTableName(entityObj) {
  let entityName = entityObj.name;
  let tableName = `${entityName}s`;
  return tableName;
}

function getColumnString(entityObj, columnKey) {
  let columns = Object.keys(entityObj.columns);
  let columnArr = [columnKey, ...columns];
  let appendStr = ', ';
  let columnString = columnArr.reduce((ret, val) => {
    return ret.concat(val, appendStr);
  }, '');
  return {appendStr, columnString};
}

function getRetString(columnString, appendStr) {
  let lastIndexOf = columnString.lastIndexOf(appendStr);
  let retString = columnString.substring(0, lastIndexOf);
  return retString;
}

function extracted(pathDir, text) {
  const file = path.join(pathDir, stringList.filename_db_js);
  fs.writeFileSync(file, text);
  console.log(`file=\n`, file, `\n`);
  console.log(`text=\n`, text, `\n`);
}

function handleJs(dbname, reduce, pathDirGeneFile) {
  const text =
    `'use strict';

export const db = new Dexie('${dbname}');
db.version(1).stores({
${reduce}
});

`;
  extracted(pathDirGeneFile, text);
}

function handleVue(dbname, reduce, pathDirGeneFile) {
  const text =
    `'use strict';

import Dexie from 'dexie';

export const db = new Dexie('${dbname}');
db.version(1).stores({
${reduce}
});

`;
  extracted(pathDirGeneFile, text);
}

function getDatabaseJsType() {
  return {
    js: 'js',
    vue: 'vue',
  }
}
/**
 * generator datasource.js file
 * @param dbname
 * @param pathDirEntity
 * @param pathDirGeneFile
 * @param type
 */
function geneDbJs(
  dbname = null,
  pathDirEntity = null,
  pathDirGeneFile = null,
  type = getDatabaseJsType().js,
) {
  if (pathDirEntity === null || pathDirGeneFile === null) {
    return;
  }

  const reduce = handleTextArr(pathDirEntity, (filename) => {
    const requirePath = path.join(pathDirEntity, filename);
    const entityObj = Object.assign(require(requirePath));

    let tableName = getTableName(entityObj);
    let {key_: find, value_} = findPrimaryKey(entityObj);
    let columnKey = '&'.concat(find);

    delete entityObj.columns[find];
    let {appendStr, columnString} = getColumnString(entityObj, columnKey);
    entityObj.columns[find] = value_;
    let retString = getRetString(columnString, appendStr);

    return ['  ', tableName, `:`, ' ', `'${retString}'`, ',', '\n'];
  });

  if (dbname === null) {
    let rootdirname = path.basename(process.cwd())
    dbname = rootdirname
  }
  switch (type) {
    case getDatabaseJsType().js:
      handleJs(dbname, reduce, pathDirGeneFile);
      break;
    case getDatabaseJsType().vue:
      handleVue(dbname, reduce, pathDirGeneFile);
      break;
  }

}

/**
 * please make sure
 *
 * you have entity/ dir
 *
 * eg: entity/config.entity.json
 *
 * @param dbname
 * @param pathDirEntity
 * @param pathDirGeneFile
 * @param type default type=js
 */
function geneDexieAll(
  dbname = null,
  pathDirEntity = null,
  pathDirGeneFile = null,
  type = getDatabaseJsType().vue,
) {

  let value = pathDirGeneFile;
  geneDbJs(dbname, pathDirEntity, value, type);
  geneUtilDexieJs(pathDirEntity, value);

}

module.exports = {
  geneDexieAll:
  geneDexieAll,

  getDatabaseJsType:
  getDatabaseJsType,
};
