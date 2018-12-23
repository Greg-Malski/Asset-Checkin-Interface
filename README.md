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
'''vbscrpt
Dim objHTTP As Object
Dim Json As String
Dim result As String
'''

Then, we need to create our GET or POST object:

In our instance, this is all rolled into a Scoped App, so you'll end up replacing *company* with your own company. Also, you'll see the variable "env". This is normally where your subdomain for ServiceNow would be. Since I have versions of this for our Production as well as subproduction environments, I have a variable in place to make swapping between them easy. The API URL in this example GETs a property variable from ServiceNow to be sure the user is using the right version of the Interface. It's fairly basic version control, but it's been effective so far.

Next, you'll set your Headers. We're using Basic Authentication. I've replaced our actual token with the lame word TOKEN:  

Finally, you'll send it off and receive the response:  

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

Part 1 is where the Asset Data is received. We set the payload to variable "j", then pass it on to a script include for verification.

Once the script include has completed the verification, it either passes the data off to the next step (and returns a standard Status 200), or kicks back one of a few custom error codes. Then, we move on to Part 2, which composes the response and sends it back to Excel. When Excel receives the response, it uses a simple if chain to decide to what to do next. It will either move on, or freeze and wait for the user to fix the data:  

## The Script Include

The Script Include is where all the real work happens, at least on the verification side. For simplicity, we're going to stick with calling the payload j:  

Next we initialize a couple variables and start checking the data. Serial number is first because it's the most important:  

Just a simple GlideRecord to make sure it exists is all we need. If it doesn't, we kick a Status = 460 back to Excel, which Excel interprets as a request to fix the Serial Number. After the Serial Number is verified, we look at the action code, but that's a boring run-on if statement. Much more interesting is the Assignment/User check:  

First we use a GlideRecord to check whether the field contains a user's Correlation ID. This is a custom ID field that transcends all of our identity systems, over here. If it matches, it sets a bit, and then moves to check that bit + comparing the field to a few known Assignment Codes. If nothing matches, we kick back a Status = 462.

If all our checks pass, we push everything on to the next phase, then catch the RITM# and send it back to Excel for logging:  

## The Import Set and Transform Map

Version 1 of this implementation did not include the Scripted REST Endpoint or Script Include. Instead, the data came in from Excel and was written straight to an Import Table. his method was effective, but is probably not necessary if you're building this from scratch. What you will probably want, however, is the code below. In our instance, it runs as an onAfter script. First, it impersonates the Technician. This is important because we want the update to accurately reflect the Tech making it, and not "System Administrator" or some other such account. After that, we launch a Request. The Request's workflow is where we do the work. We did this because Requests already have a field for linking them with a CI, so it was an easy place to log the movements in perpetuity. This also allowed us to set up a Related List on the Asset Form that will list all of the recorded movements of the asset being shown.  

## The RITM and Workflow

I'm not really going to spend any time on the Requested Item, because, frankly, if you're still with me, you probably know enough to create an Item with the appropriate variables. So, we'll move on to the workflow:  
![Checkin Workflow](https://github.com/Greg-Malski/Asset-Checkin-Interface/raw/master/Screenshots/CheckinWorkflow.png)

Toney has written a dynamic subworkflow that we use to set some variables on intialization. If you bug him enough, he might showcase it here. Once that is finished, we move along to doing some work. I'm sure you can follow most of the branches, and some of the specific updates and checks are specific to our instance, so I won't go down those bunny trails. Instead, I'll just paste the script that makes the updates below and move on:  

Ok, I cut it a little short because this post is already INSANELY long, but you get the idea. I'm going to wrap this up, here. You've got all the building blocks above, but I'll be posting all the code into GitHub so that you can see all the pieces in their natural state. Also, let me know if you have questions or suggestions.

[GitHub](https://github.com/Greg-Malski/Asset-Checkin-Interface)
