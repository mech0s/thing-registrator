const mDnsSd = require('node-dns-sd');
const LinkSmartThingDirectory = require('link_smart_thing_directory');
const axios = require('axios');

let thingsLocation = new URL("http://localhost:8080/");
// override with command line arg host=URL
let customLocation = null;
// test value 
// // customLocation = new URL("http://192.168.139.177:8888/");
if ( process.argv.length > 2) {
    console.log("Using custom base URL: ", process.argv[2].split('=')[1]);
    customLocation = new URL( process.argv[2].split('=')[1] )
}
thingsLocation = customLocation ? customLocation : thingsLocation;

const ipv4_regex = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}$/gm;   
let originalHost;
let customHost;
axios.get(thingsLocation.toString())  //base url returns a list of TD urls
    .then((res) => {
        const requests = [];
        res.data.forEach(element=> {
            console.log(JSON.stringify(element))
            let elementUrl; try { elementUrl = new URL(element);} catch {} // undefined if this exceptions
            let wellFormed  = ( elementUrl && ipv4_regex.test(elementUrl.hostname) );
            ipv4_regex.lastIndex = 0; // test -> true retains the regex state, needs reset
            if ( wellFormed ){ 
                originalHost = elementUrl.host;
                if ( !customLocation ){
                    customHost = originalHost;
                } else
                {
                    customHost = customLocation.host;
                }
                requests.push(axios.get(element.replace(new RegExp(originalHost, 'g'), customHost)));    // prepare requests for TD data at urls
            }
        })
        axios.all(requests)                          // block on all reponse promises, awaiting responses
        .then(axios.spread((...responses)=> {
            const tds = [];                         // process each response
            for ( var response of responses) {
                if (!customLocation) tds.push( response.data)
                else {
                    //let customHost = customLocation.host;
                    //let originalHost = new URL(response.config.url).host;
                    datastring = JSON.stringify(response.data)
                    tds.push ( JSON.parse(datastring.replace(new RegExp(originalHost, 'g'), customHost) ))
                }
                }
            if ( tds.length == 0 ){
                console.log("No valid TD at URL: " + thingsLocation);
            }
            else {
                console.log("Things Descriptors to register:");
                console.log(JSON.stringify(tds));
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
    const directory = {address:"127.0.0.1", port:8081};  
    device_list.forEach(element => { // only one directory handled for now, defaults to 127.0.0.1:8081
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
                console.log('Directory: ' + JSON.stringify(directory) + '. TD registration successful.');
            }
            });
        }
    }).catch((error) => {
    console.error(error);
    });
}