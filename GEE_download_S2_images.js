var batch = require('users/fitoprincipe/geetools:batch')
//var roi_puerto2 = ee.Feature(roi_puerto);
//var polygonCoordinates = roi.coordinates();
//print(polygonCoordinates, 'coordinates')

var start = ee.Date('2021-01-27');
var finish = ee.Date('2022-01-28');

// get image collection Sentinel-2 with cloud cover less than 5%
var S2_cloudfree = S2.filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 100))
                    .sort('CLOUDY_PIXEL_PERCENTAGE')
                    .filterBounds(roi2)
                    //.filter(ee.Filter.contains('.geo', roi2)) // get images that are entirely in ROI, instead of partly
                    .map(function(image){return image.clip(roi2)}) // clip collection to ROI
                    .filterDate(start, finish)
                    //.select(['B2','B3','B4','B1', 'B8']); 

var S2_cloudfree = S2_cloudfree.select(['B1','B2','B3','B4','B5','B6','B7','B8','B8A','B9','B11','B12'], ['B1','B2','B3','B4','B5','B6','B7','B8','B8A','B9','B11','B12'])

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

print(nir_masked)


// ////////// IMAGE MOSAIC ///////////

function mosaicByDate(imcol){
  // imcol: An image collection
  // returns: An image collection
  var imlist = imcol.toList(imcol.size())

  var unique_dates = imlist.map(function(im){
    return ee.Image(im).date().format("YYYY-MM-dd")
  }).distinct()

  var mosaic_imlist = unique_dates.map(function(d){
    d = ee.Date(d)

    var im = imcol
      .filterDate(d, d.advance(1, "day"))
      .mosaic()

    return im.set(
        "system:time_start", d.millis(), 
        "system:id", d.format("YYYY-MM-dd"))
  })

  return ee.ImageCollection(mosaic_imlist)
}

var ic_m = mosaicByDate(nir_masked)
var ic_m = ic_m.filter(ee.Filter.contains('.geo', roi2));

print(ic_m,'ic_m_filtered')

// // Make list of image collection
var listOfImages = ic_m.toList(ic_m.size());
print(listOfImages,'ListImage')
var image = ee.Image(listOfImages.get(8));
var image_print = image
//var image_print = image_print.select(['B1','B2','B3','B4','B5','B6','B7','B8','B8A','B9','B11','B12'], ['B1','B2','B3','B4','B5','B6','B7','B8','B8A','B9','B11','B12'])

print(image_print, 'image_print')

// Visualisation
//Map.centerObject(image_print, 9);
var trueColorViz = {
  bands: ['B4', 'B3', 'B2'],
  min: 0,
  max: 2700,
  gamma: 1.3
};

Map.addLayer(image_print, trueColorViz, 'masked');

// Projection
var projection = reference.projection().getInfo();
var imgColList = ic_m.toList(81);
print(imgColList)
var image_test = ee.Image(imgColList.get(0));

Map.addLayer(image_test, trueColorViz, 'image0');


for (var i = 0; i < 81; i++){
  var img = ee.Image(imgColList.get(i));
  var id = 'filenameprefix' + i;
  var date = img.date().format('yyyy-MM-dd').getInfo()
  var name = date.toString()
  print(name)
  Export.image.toDrive({
    image       : img,
    description : name,
    fileNamePrefix: name,
    folder      : 'GEE_mosaic_reflectence_no_cloudmask_2021',
    region      : roi2,
    scale       : 10,
    crs         : 'EPSG:32619',
    maxPixels   : 1e13
  });
}
           
