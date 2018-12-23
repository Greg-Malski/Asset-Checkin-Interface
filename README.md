I figure we all have that team. The folks that have their special way of doing things that nobody can change because their management structure goes just high enough to thwart all efforts. Unfortunately, for me, this team was Laptop Deployment. We started standing up the CMDB, and got all of our End User devices loaded into ServiceNow, but the Deployment team didn’t like the idea of logging in to ServiceNow every time they needed to assign a laptop to somebody, and we couldn’t force them. Besides, they already had a super-snazzy Excel file.

Go ahead, roll your eyes, I know.

To be fair, this Excel file was pretty snazzy. It had two worksheets. On the first, a form would pop up and the Tech would scan a personalized barcode,

![TechEntry Form](https://github.com/Greg-Malski/Asset-Checkin-Interface/raw/master/Screenshots/UserEntry.png)

then the laptop’s Asset Tag, and a User Barcode, or some canned Action/Assignment codes, then press submit.

![AssetAction Form](https://github.com/Greg-Malski/Asset-Checkin-Interface/raw/master/Screenshots/AssetAction.png)

Some VBA script would run in the background and log everything to the second worksheet. They stored it on a shared drive so their analysts had access to it, but the whole process needed to move into ServiceNow.

Obviously, ServiceNow offers better reporting, better tracking, and one certain thing they wanted but could never attain with Excel: the ability to open the spreadsheet in more than one location. As a consequence of that, each building had their own files that had to be reconciled before comprehensive reporting could occur. This should have been an easy sell, and it would have been. They were completely on board with it, except that they didn’t want to give up their Excel file interface, and they didn’t want to have to log in to ServiceNow all the time.

Thankfully, REST APIs are a thing.

Most of you will know that ServiceNow has very robust support for REST APIs, but many people do not realize that Excel also has some support for REST APIs. So, here’s the plan:

![ThePlan: Excel to ServiceNow](https://github.com/Greg-Malski/Asset-Checkin-Interface/raw/master/Screenshots/ThePlan.png)

Our data will start in the Excel file. We’ll package it up and shoot it to ServiceNow via the REST API. Once it hits the Endpoint, we send it over to a script include to verify the data is good. If everything is good, it sends a standard 200 response back to Excel and then drops the data into a Catalog Item with a special workflow. If something is wrong, it sends a custom error status back to Excel which then prompts the user to fix the information.

If you don’t care about looking under the covers, here’s a great place to leave it. You’ve learned that it’s possible to link up Excel with ServiceNow and make actual updates to actual tables. If you want to peek under the covers with me, though, let’s continue on and walk through the pieces, together!

## The Excel File

This isn’t going to be a detailed VBA tutorial. There are already plenty of those in existance, but I do want to show off a few bits of code that make this thing a little more secure and a little more cool.

First off, let’s talk about the code required to POST and GET. I wish I could tell you exactly from where I stole this, but suffice it to say, it’s pretty available though a simple Google search.

First, you need to define a couple of variables:
```vb
Dim objHTTP As Object
Dim Json As String
Dim result As String
```

Then, we need to create our GET or POST object:
```vb
Set objHTTP = CreateObject("MSXML2.ServerXMLHTTP")
Url = "https://" & env & ".service-now.com/api/now/table/sys_properties?sysparm_fields=value&name=x_*company*_ssb_api.excel_version"
objHTTP.Open "GET", Url, False
```

In our instance, this is all rolled into a Scoped App, so you'll end up replacing *company* with your own company. Also, you'll see the variable "env". This is normally where your subdomain for ServiceNow would be. Since I have versions of this for our Production as well as subproduction environments, I have a variable in place to make swapping between them easy. The API URL in this example GETs a property variable from ServiceNow to be sure the user is using the right version of the Interface. It's fairly basic version control, but it's been effective so far.

Next, you'll set your Headers. We're using Basic Authentication. I've replaced our actual token with the lame word TOKEN:  
```vb
objHTTP.SetRequestHeader "Content-Type", "application/json"
objHTTP.SetRequestHeader "Authorization", "Basic TOKEN"
```

Finally, you'll send it off and receive the response: 
```vb
objHTTP.Send (Json)
StatusNum = objHTTP.Status
Status = objHTTP.StatusText
result = objHTTP.ResponseText
``` 

Our Excel Interface uses this scripting a few times:

1.  On open, the interface checks it's version number against a property stored within ServiceNow
2.  The Technician's barcode is compared against an Authorization Table within the Scoped App and their name is returned
3.  The asset movement data is sent to ServiceNow and a completion or failure code is returned

Another cool feature of the Excel interface involves receiving the Response. Excel doesn't have a built-in JSON parser, but it is able to separate out the Status Codes.  
For the full Excel Interface, check it out here on GitHub. To access the VBA console, open the Excel File, ignore the error message caused by a bad URL, and hit Alt+F11.  
A few other features of the Excel Spreadsheet:

*   Local Logging
*   Stockroom Support

## The Scripted REST Endpoint

Once the Excel file packages up the update and shoots it over to ServiceNow, the package is caught by a Scripted REST Endpoint. This Endpoint is pretty simple and consists of two parts:  
```javascript
(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    //Receive Asset Data
    var j = request.body.data;
 
    gs.info('Asset Movement Received' , 'SSB');
    gs.debug('Asset Movement Body Data: ' + JSON.stringify(j) , 'SSB');
   
    var foo = new x_ihgih_ssb_api.assetVeritas();
 
    //Send Response
    var statusReturned = foo.veritasReply(j);
   
    gs.info('Completing Processing' , 'SSB');
    gs.debug('REST Endpoint completed. Returned: ' + JSON.stringify(statusReturned) , 'SSB');
   
    response.setContentType('application/json');
    response.setStatus(statusReturned.http_status);
   
    var writer = response.getStreamWriter();
    writer.writeString(JSON.stringify(statusReturned));
   
    })(request, response);
```

Part 1 is where the Asset Data is received. We set the payload to variable "j", then pass it on to a script include for verification.

Once the script include has completed the verification, it either passes the data off to the next step (and returns a standard Status 200), or kicks back one of a few custom error codes. Then, we move on to Part 2, which composes the response and sends it back to Excel. When Excel receives the response, it uses a simple if chain to decide to what to do next. It will either move on, or freeze and wait for the user to fix the data:  
```vb
'Print Response
Dim responseError As String
 
If StatusNum = "200" Then
    DataEntry.Range("G25").Value = "Asset update successful!"
    responseError = False
ElseIf StatusNum = "429" Then
    MsgBox "ServiceNow is currently experiencing an overload. Please try again in a moment." & vbNewLine & "If this problem persists, use the Failover Request"
    responseError = True
ElseIf StatusNum = "460" Then
    MsgBox "The Serial Number received did not match any assets. Please try again."
    responseError = True
    Status = "Invalid Serial Number"
ElseIf StatusNum = "461" Then
    MsgBox "The Action code received was invalid. Please try again."
    responseError = True
    Status = "Invalid Action Code"
ElseIf StatusNum = "462" Then
    MsgBox "The Assignment code received was invalid or the Correlation ID received did not match any users. Please try again."
    responseError = True
    Status = "Invalid Assignment or User"
ElseIf StatusNum = "500" Then
    MsgBox "ServiceNow experienced an error. Please contact support if this persists."
    responseError = True
    Status = "ServiceNow Error"
Else
    DataEntry.Range("G25").Value = Status & ": " & result
End If
```

## The Script Include

The Script Include is where all the real work happens, at least on the verification side. For simplicity, we're going to stick with calling the payload j:  
```javascript
var j = request;
var answer = {}; //Prepare response payload
               
    gs.info('Starting process to add to Asset Movement Import Table');
    gs.debug('Script Include received payload: ' + JSON.stringify(j));
    ```

Next we initialize a couple variables and start checking the data. Serial number is first because it's the most important:  
```javascrpt
//Initialize a couple variables before proceeding
var valid = true;
var userValid = false;
       
//Is Serial Number valid?
var assetGR = new GlideRecord('alm_asset');
assetGR.addQuery('serial_number',j.u_machine);
assetGR.query();
if (assetGR.next()){
    //ok
}else{
    answer.http_status = "460";
    answer.status_message = 'Rejected - Invalid Serial Number. Received ' + j.u_machine;
   
    return answer;
}
```

Just a simple GlideRecord to make sure it exists is all we need. If it doesn't, we kick a Status = 460 back to Excel, which Excel interprets as a request to fix the Serial Number. After the Serial Number is verified, we look at the action code, but that's a boring run-on if statement. Much more interesting is the Assignment/User check: 
```javascript
//Is assignment a user?
var userGR = new GlideRecord('sys_user');
userGR.addQuery('u_correlation_id', j.u_assignment);
userGR.query();
 
if (userGR.next()){
    userValid = true;
}
 
//Is assignment valid?
if (j.u_assignment == "NEW HARDWARE" || j.u_assignment ==  "IMAGED" || j.u_assignment ==  "TRIAGE" || j.u_assignment ==  "DISPOSAL" || j.u_assignment ==  "RMA" || userValid == true){
    //ok
}else{
    answer.http_status = "462";
    answer.status_message = 'Rejected - Invalid Assignment. Received ' + j.u_assignment;
   
    return answer;
}
``` 

First we use a GlideRecord to check whether the field contains a user's Correlation ID. This is a custom ID field that transcends all of our identity systems, over here. If it matches, it sets a bit, and then moves to check that bit + comparing the field to a few known Assignment Codes. If nothing matches, we kick back a Status = 462.

If all our checks pass, we push everything on to the next phase, then catch the RITM# and send it back to Excel for logging: 
```javascript
//If we're all good, send the data on to the Transform Map
if(valid == true){
    var moveAsset = new GlideRecord('x_ihgih_ssb_api_ssb_checkin_landing');
    moveAsset.initialize();
    moveAsset.u_machine = j.u_machine;
    moveAsset.u_action = j.u_action;
    moveAsset.u_assignment = j.u_assignment;
    moveAsset.u_stockroom = j.u_stockroom;
    moveAsset.u_tech = j.u_tech;
   
    var importSysId = moveAsset.insert();
    var importSetRowStatus = '';
   
    var assetRITM = 'A';
    var assetRITMgr = new GlideRecord('sc_req_item');
    assetRITMgr.addEncodedQuery('cmdb_ci.serial_number='+j.u_machine+'^ORDERBYDESCopened_at');
    assetRITMgr.setLimit(1);
    assetRITMgr.query();
    if (assetRITMgr.next()){
        assetRITM = assetRITMgr.number.toString();
        gs.info('Asset RITM gr: ' + assetRITMgr);
        gs.info('Asset RITM: ' + assetRITM);
    }
   
    gs.info('No if Asset RITM: ' + assetRITM);
    answer.http_status = "200";
    answer.status_message = 'All good. Request Number: ' + assetRITM;
    answer.importSysId = importSysId;
    answer.RequestNum = assetRITM;
}
gs.debug('Script Include assetVeritas concluding with: ' + JSON.stringify(answer));
return answer;
``` 

## The Import Set and Transform Map

Version 1 of this implementation did not include the Scripted REST Endpoint or Script Include. Instead, the data came in from Excel and was written straight to an Import Table. his method was effective, but is probably not necessary if you're building this from scratch. What you will probably want, however, is the code below. In our instance, it runs as an onAfter script. First, it impersonates the Technician. This is important because we want the update to accurately reflect the Tech making it, and not "System Administrator" or some other such account. After that, we launch a Request. The Request's workflow is where we do the work. We did this because Requests already have a field for linking them with a CI, so it was an easy place to log the movements in perpetuity. This also allowed us to set up a Related List on the Asset Form that will list all of the recorded movements of the asset being shown. 
```javascript
if(req_submit == true){
    //Impersonate Tech - Imperative for Proper Audit reporting
    gs.include('global.Impersonator');
    var impersonator =  new global.Impersonator().impersonateUser(techSYS);
    gs.debug('I am impersonating '+impersonator);
    //create RITM
    var cart = new sn_sc.CartJS();
    var item =
    {
        'sysparm_id': '27e0e16ddb505b0029c804c2ca96199b',
        'sysparm_quantity': '1',
        'variables': {
            'req_tech_ref': ""+techSYS+"",
            'u_requested_by': ""+techSYS+"",
            'req_machine_ref': ""+target.sys_id+"",
            'req_action': ""+source.u_action+"",
            'req_assignment_string': ""+source.u_assignment+"",
            'req_assignment_ref': ""+userSYS+"",
            'u_requested_for': ""+userSYS+"",
            'req_imp_set': ""+imp_set+"",
            'req_stockroom': ""+source.u_stockroom+""
        }};
        var cartDetails = cart.addToCart(item);
        gs.info('Cart details: '+JSON.stringify(cartDetails)+' Machine= '+target.sys_id);
        gs.info('Cart sysID: '+cartDetails.sys_id);
        var checkoutInfo = cart.checkoutCart();
        gs.info('Checkout Info: '+checkoutInfo);
        gs.info('Checkout Completed');
}
``` 

## The RITM and Workflow

I'm not really going to spend any time on the Requested Item, because, frankly, if you're still with me, you probably know enough to create an Item with the appropriate variables. So, we'll move on to the workflow:  
![Checkin Workflow](https://github.com/Greg-Malski/Asset-Checkin-Interface/raw/master/Screenshots/CheckinWorkflow.png)

Toney has written a dynamic subworkflow that we use to set some variables on intialization. If you bug him enough, he might showcase it here. Once that is finished, we move along to doing some work. I'm sure you can follow most of the branches, and some of the specific updates and checks are specific to our instance, so I won't go down those bunny trails. Instead, I'll just paste the script that makes the updates below and move on:  
```javascript
var target = new GlideRecord('alm_asset');
 
target.addQuery('sys_id',current.variable_pool.req_machine_ref);
target.query();
if(target.next()){
    current.cmdb_ci = target.ci; //Associate request to CI
    target.assigned = current.opened_at; //Set Assignment Date to match request
   
    //Set state for Check In/New Hardware
    if (current.variable_pool.req_action == 'Check In'){
        if(current.variable_pool.req_assignment_string == 'NEW HARDWARE'){
            target.install_status = '6'; //State = In Stock
            target.substatus = 'pending_image'; //Substate = Pending Image
            target.stockroom = current.variable_pool.req_stockroom; //Stockrom matches submission
            target.update();
            current.short_description = "Checked in, Pending Image";
        } else if(current.variable_pool.req_assignment_string == 'IMAGED'){
            target.install_status = '6'; //State = In Stock
            target.substatus = 'available'; //Substate = Available
            target.stockroom = current.variable_pool.req_stockroom; //Stockrom matches submission
            target.update();
            current.short_description = "Checked in after imaging";
        } else if (current.variable_pool.req_assignment_string == 'TRIAGE'){
            target.install_status = '6'; //State = In Stock
            target.substatus = 'being_triaged'; //Substate = Being Triaged
            target.stockroom = current.variable_pool.req_stockroom; //Stockrom matches submission
            target.update();
            current.short_description = "Turned in, waiting for keep/dispose decision";
        }
    } else if (current.variable_pool.req_action == 'Check Out'){
        if(current.variable_pool.req_assignment_string == 'NEW HARDWARE'){
            target.install_status = '3'; //State = In Maintenance
            target.substatus = 'imaging'; //Substate = Imaging
            target.u_assigned_tech = current.variable_pool.req_tech_ref; //Assign to Tech
            target.update();
            current.short_description = "Checked out to Tech for Imaging";
        }
    }
}
```

Ok, I cut it a little short because this post is already INSANELY long, but you get the idea. I'm going to wrap this up, here. You've got all the building blocks above, but I'll be posting all the code into GitHub so that you can see all the pieces in their natural state. Also, let me know if you have questions or suggestions.

[GitHub](https://github.com/Greg-Malski/Asset-Checkin-Interface)
