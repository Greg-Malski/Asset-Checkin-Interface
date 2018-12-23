(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
	
	var j = request.body.data;
	gs.info('Asset Movement Received' , 'SSB');
	gs.debug('Asset Movement Body Data: ' + JSON.stringify(j) , 'SSB');
	
	var foo = new x_ihgih_ssb_api.assetVeritas();
	var statusReturned = foo.veritasReply(j);
	
	gs.info('Completing Processing' , 'SSB');
	gs.debug('REST Endpoint completed. Returned: ' + JSON.stringify(statusReturned) , 'SSB');
	
	response.setContentType('application/json');
	response.setStatus(statusReturned.http_status);
	
	var writer = response.getStreamWriter();
	writer.writeString(JSON.stringify(statusReturned));
 	
	/* //For Testing only
	var answer = {};
		
		answer.http_status = '505';
		answer.status_message = 'I see you';
		
		response.setContentType('application/json');
		response.setStatus(answer.http_status);
		
		var writer = response.getStreamWriter();
		writer.writeString(JSON.stringify(answer));
		*/
	})(request, response);