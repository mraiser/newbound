var me = this;
var ME = $('#'+me.UUID)[0];

me.ready = function(){
  var d = ME.DATA;
  var v = d.value ? d.value : { "x":"0.0", "y":"0.0", "z":"0.0" };
  ME.DATA.value = v;
  
  var lx = d.labels && d.labels.x ? d.labels.x : "X";
  var ly = d.labels && d.labels.y ? d.labels.y : "Y";
  var lz = d.labels && d.labels.z ? d.labels.z : "Z";
  
  var newhtml = "<table border='0' cellpadding='0' cellspacing='5'><tr><td>"+lx+": <input type='number' value='"+v.x+"' class='vectorvalue'></td><td>"+ly+": <input type='number' value='"+v.y+"' class='vectorvalue'></td><td>"+lz+": <input type='number' value='"+v.z+"' class='vectorvalue'></td></tr></table>";
  $(ME).append(newhtml).find("input").change(function(){
    var texts = $(ME).find("input");
    ME.DATA.value.x = texts[0].value;
    ME.DATA.value.y = texts[1].value;
    ME.DATA.value.z = texts[2].value;
    if (ME.DATA.cb) ME.DATA.cb(ME.DATA.value);
  });
  
  componentHandler.upgradeAllRegistered();
};
