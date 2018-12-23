var assetVeritas = Class.create();
assetVeritas.prototype = {
	initialize: function() {
		
	},
	veritasReply: function(request) {
		try{
			var j = request;
			var answer = {}; //Prepare response payload
				
				gs.info('Starting process to add to Asset Movement Import Table');
				gs.debug('Script Include received payload: ' + JSON.stringify(j));
				
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
				
				//Is action valid?
				if (j.u_action == "Check In" || j.u_action == "Check Out" || j.u_action == "Preparing for User" || j.u_action == "Ready for Pickup" || j.u_action == "Shipping to User"){
					//ok
				}else{
					
					answer.http_status = "461";
					answer.status_message = 'Rejected - Invalid Action. Received ' + j.u_action;
					
					return answer;
				}
				
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
					//answer.status_message = 'All good. Import Set Row sys_id: ' + importSysId;
					answer.status_message = 'All good. Request Number: ' + assetRITM;
					answer.importSysId = importSysId;
					answer.RequestNum = assetRITM;
					
				}else{
					answer.http_status = "500";
					answer.status_message = 'Unexpected Error occured. Have somebody look at the Scripts in ServiceNow';
					
					return answer;
				}
				gs.debug('Script Include assetVeritas concluding with: ' + JSON.stringify(answer));
				return answer;
				
			}
			catch(bar) {
				gs.error(bar + ' from payload: ' + JSON.stringify(j));
				
				answer.http_status = '500';
				answer.status_message = 'Internal ServiceNow Error: ' + bar;
				return answer;
			}
			
		},
		
		testSimpleResponse: function(){
			var answer = {}; //Prepare response payload
				answer.http_status = '200';
				answer.status_message = 'Tests Passed';
				return answer;
			},
			
			type: 'assetVeritas'
		};