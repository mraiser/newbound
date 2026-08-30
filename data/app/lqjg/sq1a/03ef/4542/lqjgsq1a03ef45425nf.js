var me = this;
var ME = $('#' + me.UUID)[0];

// The wrapper div a data-control mounts into stays in the DOM; erase it
// from layout so the anchor participates in the host header exactly where
// the old inline icon sat.
ME.style.display = 'contents';

// Hosts with their own header styling pass it in:
// data-control='app:home:{"cls":"fr-wordmark"}'
if (ME.DATA && ME.DATA.cls) $(ME).find('.nb-home').addClass(ME.DATA.cls);

// Login check (moved here from app:app): the probe is admin-gated, so an
// expired or absent session answers UNAUTHORIZED and we go to the login page.
json('../app/newlib', 'lib=runtime&readers=[]&writers=[]', function(result) {
  if (result.status != 'ok' && result.msg.indexOf("UNAUTHORIZED") != -1) {
    window.location.href = '../app/login.html';
  }
});
