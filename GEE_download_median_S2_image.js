var batch = require('users/fitoprincipe/geetools:batch')

// get image collection Sentinel-2 with cloud cover less than 5%
var S2_cloudfree = S2.filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 5))
                    .sort('CLOUDY_PIXEL_PERCENTAGE')
                    .filterBounds(roi2)
                    //.filter(ee.Filter.contains('.geo', roi2)) // get images that are entirely in ROI, instead of partly
                    .map(function(image){return image.clip(roi2)}) // clip collection to ROI
                    //.filterDate(start, finish)
                    //.select(['B2','B3','B4','B1', 'B8']); 

var S2_cloudfree = S2_cloudfree.select(['B1','B2','B3','B4','B5','B6','B7','B8','B8A','B9','B11','B12'], ['B1','B2','B3','B4','B5','B6','B7','B8','B8A','B9','B11','B12'])
print(S2_cloudfree)

/////// WATER AND CLOUD MASK ///////////
// This is an image with just 1. Used fo building mask
var myImage = ee.Image.constant(1);

// define mask shapefile 
var myFeature = ee.Feature(mask_shp);
    
// create an image that is a mask from features.
var newImage = myImage.clip(myFeature).mask().not();

// Apply own mask
var own_masked = S2_cloudfree.map(function(image){
  return image.updateMask(newImage)  
})

// function addNdwi(img) {
function addNdwi(image){
  var ndwi = image.normalizedDifference(['B2', 'B8']).rename('NDWI');
  return image.addBands(ndwi)}

var NDWI = own_masked.map(addNdwi);

// Create a Boolean land mask from the NIR band; water and clouds are 0, land is 1. 
var nir_masked = NDWI.map(function(image){
  return image.mask(image.select('NDWI').gt(0.2));
})
var nir_masked = nir_masked.select(['B1','B2','B3','B4','B5','B6','B7','B8','B8A','B9','B11','B12'], ['B1','B2','B3','B4','B5','B6','B7','B8','B8A','B9','B11','B12'])
print(nir_masked, 'nir_masked')

var median = nir_masked.median()
print(median)

// Visualisation
var trueColorViz = {
  bands: ['B4', 'B3', 'B2'],
  min: 0,
  max: 2700,
  gamma: 1.3
};
Map.addLayer(median, trueColorViz, 'median_image');

var reference = reference.toFloat();
var median = median.toFloat();
var stack = median.addBands(reference); // make layer stack with reference and Z scores
print(stack, 'stack')
Map.addLayer(stack, trueColorViz, 'stack');


Export.image.toDrive({
  image: stack,
  description: 'median_stack_30',
  crs: 'EPSG:32619',
  region: roi2,
  scale: 30
});
