window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = null;
var isPlaying = false;
var sourceNode = null;
var analyser = null;
var theBuffer = null;
var DEBUGCANVAS = null;
var mediaStreamSource = null;

var rafID = null;
var tracks = null;
var buflen = 1024;
var buf = new Float32Array(buflen);

// default sensivity is 5hz, checking 5times with 1ms interval
var inputSens = 5;
var inputRep = 5;
var inputInter = 1;
var inputMin = 90;
var inputMax = 255;

var MIN_SAMPLES = 0; // will be initialized when AudioContext is created.

window.onload = function() {

  audioContext = new AudioContext();


  //why 5khz? will learn
  MAX_SIZE = Math.max(4, Math.floor(audioContext.sampleRate / 5000));
  // corresponds to a 5kHz signal





};

function error() {
  alert('Stream generation failed.');
}

function getUserMedia(dictionary, callback) {
  try {
    navigator.getUserMedia =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia;
    navigator.getUserMedia(dictionary, callback, error);
  } catch (e) {
    alert('getUserMedia threw exception :' + e);
  }
}

function gotStream(stream) {
  // Create an AudioNode from the stream.
  mediaStreamSource = audioContext.createMediaStreamSource(stream);

  // Connect it to the destination.
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  mediaStreamSource.connect(analyser);
  updatePitch();
}


function toggleLiveInput() {
  if (isPlaying) {
    //stop playing and return
    // sourceNode.stop(0);
    sourceNode = null;
    analyser = null;
    isPlaying = false;
    document.getElementById("toggleInputButton").innerHTML = "Start";
    if (!window.cancelAnimationFrame)
      window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
    window.cancelAnimationFrame(rafID);
  } else {
    document.getElementById("toggleInputButton").innerHTML = "Stop";
    isPlaying = true;
    getUserMedia({
      "audio": {
        "mandatory": {
          "googEchoCancellation": "false",
          "googAutoGainControl": "false",
          "googNoiseSuppression": "false",
          "googHighpassFilter": "false"
        },
        "optional": []
      },
    }, gotStream);
  }
}





/* License for autoCorrelate function

The MIT License (MIT)

Copyright (c) 2014 Chris Wilson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

function autoCorrelate(x, sampleRate) {

  var SIZE = buf.length;
  var MAX_SAMPLES = Math.floor(SIZE / 2);
  var best_offset = -1;
  var best_correlation = 0;
  var rms = 0;
  var foundGoodCorrelation = false;
  var correlations = new Array(MAX_SAMPLES);

  for (var i = 0; i < SIZE; i++) {
    var val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) // not enough signal
    return -1;

  var lastCorrelation = 1;
  for (var offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
    var correlation = 0;

    for (i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs((buf[i]) - (buf[i + offset]));
    }
    correlation = 1 - (correlation / MAX_SAMPLES);
    correlations[offset] = correlation; // store it, for the tweaking we need to do below.
    if ((correlation > 0.9) && (correlation > lastCorrelation)) {
      foundGoodCorrelation = true;
      if (correlation > best_correlation) {
        best_correlation = correlation;
        best_offset = offset;
      }
    } else if (foundGoodCorrelation) {
      // short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
      // Now we need to tweak the offset - by interpolating between the values to the left and right of the
      // best offset, and shifting it a bit.  This is complex, and HACKY in this code (happy to take PRs!) -
      // we need to do a curve fit on correlations[] around best_offset in order to better determine precise
      // (anti-aliased) offset.

      // we know best_offset >=1,
      // since foundGoodCorrelation cannot go to true until the second pass (offset=1), and
      // we can't drop into this clause until the following pass (else if).
      var shift = (correlations[best_offset + 1] - correlations[best_offset - 1]) / correlations[best_offset];
      return sampleRate / (best_offset + (8 * shift));
    }
    lastCorrelation = correlation;
  }
  if (best_correlation > 0.01) {
    return sampleRate / best_offset;
  }
  return -1;

}


//get validated pitch for given sensivity
function validatePitch(confidenceIntervalForPitch, repeatTimes, sensivityMilliseconds, callback) {
  //sensivityMilliseconds is exactly how long should program wait for next lookup for pitch
  var j = 0;
    var pitchToBeChecked = autoCorrelate(buf, audioContext.sampleRate);
    for (i = 1; i <= repeatTimes; i++) {


          setTimeout(function() {

          var currentPitch = autoCorrelate(buf, audioContext.sampleRate);
          // console.log('a');
          // var datetime = " - LastSync: "+ new Date().getHours() +"."+ new Date().getMinutes() + ":" + new Date().getMilliseconds();
          // console.log("current output: " + currentPitch + datetime + "," + j);
          if (currentPitch < pitchToBeChecked + confidenceIntervalForPitch && currentPitch > pitchToBeChecked - confidenceIntervalForPitch) {
            j++;


            if (j == repeatTimes) { //if checks are done
              var datetime = " - LastSync: "+ new Date().getHours() +"."+ new Date().getMinutes() + ":" + new Date().getMilliseconds();
              console.log("Returned output: " + pitchToBeChecked + datetime + "," + j);
              callback(pitchToBeChecked);
            }
          }
          else {
            i=repeatTimes;
          }
        }, i * sensivityMilliseconds);
    }
}


function updatePitch(time) {
  analyser.getFloatTimeDomainData(buf);
  var ac = autoCorrelate(buf, audioContext.sampleRate);

  if (document.getElementById("inputSensivity") !== null)
    inputSens = document.getElementById("inputSensivity").value;
  if (document.getElementById("inputRepeats") !== null)
    inputRep = document.getElementById("inputRepeats").value;
  if (document.getElementById("inputInterval") !== null)
    inputInter = document.getElementById("inputInterval").value;
  if (document.getElementById("inputMin") !== null)
    inputMin = document.getElementById("inputMin").value;
  if (document.getElementById("inputMax") !== null)
    inputMax = document.getElementById("inputMax").value;
    var o = document.getElementById("outputPitch");


  if (ac != -1) {

    validatePitch(inputSens, inputRep, inputInter,
      function(pitch) {
        if (pitch > inputMin && pitch < inputMax) {
          o.innerHTML = pitch;
          //now output might be correctly filtered from harmonics

        }
      }
    );
  }



  if (!window.requestAnimationFrame)
    window.requestAnimationFrame = window.webkitRequestAnimationFrame;
  rafID = window.requestAnimationFrame(updatePitch);

}
