/**
 * export IAM roles to JSON files
 */
'use strict';

const path = require('path');
const through2 = require('through2');
const iam = require('./aws/iam');
const FileUtil = require('./utils/file');
const promisedLife = require('promised-lifestream');
const ListRoleStream = require('./aws/list_stream').ListRoleStream;
const promisedStream = require('./utils/stream').promisedStream;
const Status = require('./utils/status_code')(true);


function listRolePolicies(role) {
  const params = { RoleName: role.RoleName };
  return iam.listAttachedRolePolicies(params).promise()
  .then(data => {
    return {
      Role: role,
      AttachedPolicies: data.AttachedPolicies
    }
  });
}


function writeRoleFile(parentDir, item) {
  const role = item.Role;
  const result = {
    Role: {
      RoleName: role.RoleName,
      Path: role.Path,
      AssumeRolePolicyDocument: JSON.parse(decodeURIComponent(role.AssumeRolePolicyDocument))
    },
    AttachedPolicies: item.AttachedPolicies
  }

  const fileName = path.join(parentDir, role.RoleName + '.json');
  const jsonStr = JSON.stringify(result, null, 4);

  return FileUtil.writeFilePromise(fileName, jsonStr)
  .then(() => `${Status.OK} Wrote ${fileName}\n`)
  .catch(err => `${Status.NG} Failed to write ${fileName}\n`);
}


module.exports = function(outDir, nameMatcher) {
  promisedLife([
    new ListRoleStream(),
    through2.obj(function (role, _, callback) {
      if (role.RoleName.match(nameMatcher)) {
        listRolePolicies(role)
        .then(result => {
          this.push(result);
          callback();
        })
        .catch(err => { callback(err) });
      } else {
        callback();
      }
    }),
    promisedStream(item => writeRoleFile(outDir, item) ),
    process.stdout
  ])
  .catch(err => {
    console.error(err.stack)
  });
}