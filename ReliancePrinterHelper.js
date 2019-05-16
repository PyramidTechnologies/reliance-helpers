/**
 * @file ReliancePrinterHelper.js
 * @version 0.0.1
 */

/**
 * Enum containing some valid kernels for the dithering process.
 * @readonly
 * @enum {Array}
 */
var ditheringMatrixPatterns = {
  JARVIS_JUDICE_NINKE: [
    [0, 0, 0, 7 ,5],
    [3, 5, 7, 5, 3],
    [1, 3, 5, 3, 1]
  ],
  ATKINSON: [
    [0, 0, 1, 1],
    [1, 1, 1, 0],
    [0, 1, 0, 0]
  ]
};

/**
 * Creates a new instance of ReliancePrinterHelper.
 * @class
 * @param {Array} matrixPattern 
 * @param {Number} divisor 
 * @param {Number} threshold 
 */
function ReliancePrinterHelper(matrixPattern, divisor, threshold) {

  // Set default parameters.
  if (matrixPattern === undefined) matrixPattern = ditheringMatrixPatterns.JARVIS_JUDICE_NINKE;
  if (divisor === undefined) divisor = 48;
  if (threshold === undefined) threshold = 128;
  
  /**
   * Private members
   */

  /**
   * @function applyGrayscale
   * @param {Array} pixel - Pixel data in RGBA order.
   * @returns {Array} The grayscale conversion of the pixel.
   */
  var applyGrayscale = function(pixel) {
    var grayPoint = 0.299 * pixel[0] + 0.587 * pixel[1] + 0.114 * pixel[2];
    var grayed = (grayPoint < threshold) ? 0 : 255;
    return [grayed, grayed, grayed, pixel[3]];
  };

  /**
   * @function applySmoothing
   * @param {Array} pixelData
   * @param {Array} colored
   * @param {Array} grayed 
   * @param {Number} x 
   * @param {Number} y 
   * @param {Number} width
   * @param {Number} height
   */
  var applySmoothing = function(pixelData, colored, grayed, x, y, width, height) {
    var redError = colored[0] - grayed[0];
    var greenError = colored[1] - grayed[1];
    var blueError = colored[2] - grayed[2];

    for (var row = 0; row < rowCount; row++) {
      var ypos = y + row;
      for (var col = 0; col < colCount; col++) {
        var coefficient = matrixPattern[row][col];
        var xpos = x + col - matrixOffset;
  
        if (coefficient === 0 || xpos <= 0 || xpos >= width || ypos <= 0 || ypos >= height) {
          continue;
        }
  
        var offset = ypos * width * 4 + xpos * 4;
        var newRed = (redError * coefficient) / divisor;
        var newGreen = (greenError * coefficient) / divisor;
        var newBlue = (blueError * coefficient) / divisor;
        pixelData[offset] = safeByteCast(pixelData[offset] + newRed);
        pixelData[offset + 1] = safeByteCast(pixelData[offset + 1] + newGreen);
        pixelData[offset + 2] = safeByteCast(pixelData[offset + 2] + newBlue);
      }
    }
  };

  /**
   * @function safeByteCast
   * @param {Number} val - Number to be clamped.
   * @returns {Number} Input number clamped to [0, 255] and rounded to the nearest integer if it is not an integer.
   */
  var safeByteCast = function(val) {
    if (val > 255) return 255;
    if (val < 0) return 0;
    return Math.round(val);
  };

  /**
   * @function dither
   * @param {Array} imageData - Array containing the data in RGBA order with integers values between 0 and 255 inclusive.
   * @param {Number} width - Width of the image, measured in pixels.
   * @param {Number} height - Height of the image, measured in pixels.
   * @returns {Array} Array of the dithered image pixels in RGBA order.
   */
  var dither = function(imageData, width, height) {
    var pixelData = imageData.slice(0);
    var index = 0;
    for (var x = 0; x < height; x++) {
      for (var y = 0; y < width; y++) {
        var colored = pixelData.slice(index, index + 4);
        var grayed = applyGrayscale(colored);
        applySmoothing(pixelData, colored, grayed, y, x, width, height);
        index += 4;
      }
    }
    return pixelData;
  };

  /**
   * @function oneBpp
   * @param {Array} pixelData - Array containing the data of a dithered image in RGBA order with integers values between 0 and 255 inclusive.
   * @param {Number} width - Width of the image, measured in pixels.
   * @param {Number} height - Height of the image, measured in pixels.
   * @returns {Array} Array of 8-bit integers representing the 1bpp conversion of the input image data.
   */
  var oneBpp = function(pixelData, width, height) {
    var out = new Array(Math.ceil(width / 8) * height);
    var tempByte = 0;
    var pixIndex = 0;
    var byteIndex = 0;
    var bitIndex = 7;
    for (var x = 0; x < height; x++) {
      for (var y = 0; y < width; y++) {
        if ((pixelData[pixIndex] * 0.299 + pixelData[pixIndex + 1] * 0.587 + pixelData[pixIndex + 2] * 0.114) < threshold) {
          tempByte += 1 << bitIndex;
        }
        pixIndex += 4;
        if (bitIndex === 0) {
          out[byteIndex++] = tempByte;
          tempByte = 0;
          bitIndex = 7;
        } else {
          bitIndex--;
        }
      }
      if (bitIndex != 7) {
        out[byteIndex++] = tempByte;
        tempByte = 0;
        bitIndex = 7;
      }
    }
    return out;
  };

  threshold = safeByteCast(threshold);          // Clamp the value for threshold to [0, 255].
  divisor = Math.max(1, Math.round(divisor));   // The divisor must be an integer greater than 0.
  var rowCount = matrixPattern.length;          // Number of rows of the matrix pattern.
  var colCount = matrixPattern[0].length;       // Number of columns of the matrix pattern.
  var matrixOffset;
  for (var i = 0; i < colCount; i++) {          // Find first non-zero coefficient column in matrix. This 
    if (matrixPattern[0][i] != 0) {             // value must always be in the first row of the matrix.
      matrixOffset = i - 1;
      break;
    }
  }

  /**
   * Public members
   */

  /**
   * @function raster
   * @param {Array} imageData - Array containing the data in RGBA order with integers values between 0 and 255 inclusive.
   * @param {Number} width - Width of the image, measured in pixels.
   * @param {Number} height - Height of the image, measured in pixels.
   * @returns {Array} Array of 8-bit integers representing the 1bpp conversion of the input image data.
   */
   this.raster = function(imageData, width, height) {
     var dithered = dither(imageData, width, height);
     return oneBpp(dithered, width, height);
   }
}
ReliancePrinterHelper.prototype = Object.create(ReliancePrinterHelper.prototype);
ReliancePrinterHelper.prototype.constructor = ReliancePrinterHelper;