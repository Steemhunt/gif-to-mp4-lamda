'use strict';

const fs = require('fs');
const aws = require('aws-sdk');
var s3 = new aws.S3();
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
ffmpeg.setFfmpegPath(path.join(__dirname, 'ffmpeg'));

let inputTemp = '/tmp/tempGif.gif';
let outputTemp = '/tmp/outputMp4.mp4';

function gifToMp4() {
  return new Promise(function(resolve, reject) {
    ffmpeg(inputTemp).outputOptions(['-movflags', 'faststart', '-pix_fmt', 'yuv420p', '-vf', "scale=trunc(iw/2)*2:trunc(ih/2)*2"]).save(outputTemp).on('end', function() {
      resolve(outputTemp);
    }).on('error', function(error) {
      reject(error);
    })
  });
}

function getObject(bucket, key) {
  return new Promise(function(resolve, reject) {
    s3.getObject({Bucket: bucket, Key: key}, function(error, data) {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    })
  })
}

function putObject(body, bucket, key) {
  return new Promise(function(resolve, reject) {
    s3.putObject({Bucket: bucket, Key: key, Body: body, ACL: 'public-read'}, function(error, data) {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    })
  })
}

function deleteObject(bucket, key) {
  return new Promise(function(resolve, reject) {
    s3.deleteObject({Bucket: bucket, Key: key}, function(error, data) {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    })
  })
}

exports.handler = (event, context, callback) => {
  const gifObjKey = 'development/transformedVideo.gif'  //event.Records[0].s3.object.key;

  getObject('huntimages', gifObjKey).then(function(originalGif) {
      fs.writeFileSync(inputTemp, originalGif.Body)

      gifToMp4().then(function(convertedMp4) {

        var fileStream = fs.createReadStream(convertedMp4);
        fileStream.on('error', function (error) {
          callback('fileStream ERROR' + JSON.stringify(error));
        });

        putObject(JSON.stringify(event) + '||||' + JSON.stringify(context), 'huntimages', 'development/log.txt' /* gifObjKey.replace(/.gif/, ".mp4")*/).then(function() {
          [inputTemp, outputTemp].forEach(function(file) {
            fs.unlinkSync(file);
          })
          callback(null, "some success message");
        }).catch(function(error) {
          callback('putObject ERROR' + JSON.stringify(error))
        })

      }).catch(function(error) {
        callback('gifToMp4 ERROR' + JSON.stringify(error))
      })
  }).catch(function(error) {
    callback('getObject ERROR' + JSON.stringify(error))
  })
}