console.log(process.argv);
const mDnsSd = require('node-dns-sd');
const LinkSmartThingDirectory = require('link_smart_thing_directory');
const axios = require('axios');

let thingsLocation = new URL("http://localhost:8080/");
// override with command line arg host=URL
let customLocation = null;
if ( process.argv.length > 2) {
    console.log(process.argv[2].split('=')[1]);
    customLocation = new URL( process.argv[2].split('=')[1] )
}
thingsLocation = customLocation ? customLocation : thingsLocation;

const ipv4_regex = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$/gm;   

axios.get(thingsLocation.toString())  //base url returns a list of TD urls
    .then((res) => {
        const requests = [];
        res.data.forEach(element=> {
            var url = null;
            try {url = new URL(element);} catch {}
            if (url != null && ipv4_regex.test(url.hostname)) {
                requests.push(axios.get(url.toString()));    // prepare requests or TD data at urls
            }
        })
        axios.all(requests)                          // block on all reponse promises, awaiting responses
        .then(axios.spread((...responses)=> {
            const tds = [];                         // process each response
            for ( var response of responses) {
                tds.push( response.data);
                }
            if ( tds.length == 0 ){
                console.log("No valid TD at URL: " + thingsLocation);
            }
            else {
                console.log("Things Descriptors to register:");
                console.log(tds);
                registerWithADirectory(tds);            // register the TD data with a directory
            }
        }))
    })
    .catch(error => {
        console.error(error);
    })


function registerWithADirectory(tds) {
    mDnsSd.discover({
    name: '_wot._tcp.local'
    }).then((device_list) =>{
    const directory = {};  // only one directory handled for now
    device_list.forEach(element => {
        directory.address = element.address;
        directory.port = element.service.port; 
    });
    const apiClient = new LinkSmartThingDirectory.ApiClient(directory.address+":"+directory.port);
    const api = new LinkSmartThingDirectory.ThingsApi(apiClient);
    for ( var td of tds ) {
        let id = td.id;
        let body = td; // Object | The Thing Description object

            api.thingsIdPut(id, body, (error, data, response) => {
            if (error) {
                console.error(error);
            } else {
                console.log('Directory: ' + JSON.stringify(directory) + '. TD registration successfull.');
            }
            });
        }
    }).catch((error) => {
    console.error(error);
    });
}