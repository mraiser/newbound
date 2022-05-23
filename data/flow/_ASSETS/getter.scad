rotate([90,0,180])scale([0.05,0.1,0.1])translate([-2,0,0])difference(){
    union(){
        cube([30,10,10],true);
        translate([5,0,0])point();
    }
    translate([-25.01,0,0])scale([1,1.1,1])point();
}

module point(){
    difference(){
        translate([7.93,0,0])rotate([0,45,0]){
            cube([10,10,10],true);
        }
        cube([20,20,20],true);
    }
}