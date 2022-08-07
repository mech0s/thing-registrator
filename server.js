console.log("OK");

const mDnsSd = require('node-dns-sd');
 
mDnsSd.discover({
  name: '_wot._tcp.local'
}).then((device_list) =>{
  //  console.log(JSON.stringify(device_list, null, '  '));
  console.log(device_list[0].address, device_list[0].service.port);
}).catch((error) => {
  console.error(error);
});