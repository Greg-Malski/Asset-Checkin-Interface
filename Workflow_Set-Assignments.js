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
		} else if (current.variable_pool.req_assignment_string == 'DISPOSAL'){
			target.install_status = '6'; //State = In Stock
			target.substatus = 'pending_disposal'; //Substate = Pending Disposal
			target.stockroom = current.variable_pool.req_stockroom; //Stockrom matches submission
			target.update();
			current.short_description = "Checked out to add to Disposal pile";
		} else if (current.variable_pool.req_assignment_string == 'RMA'){
			target.install_status = '3'; //State = In Maintenance
			target.substatus = 'rma'; //Substate = RMA
			target.u_assigned_tech = current.variable_pool.req_tech_ref; //Assign to Tech
			target.update();
			current.short_description = "Checked Out for RMA";
			//Need to figure out how to kick off task to request more information
		} else if (current.variable_pool.req_assignment_ref != ''){
			target.install_status = '1'; //State = In use
			target.substatus = ''; //No Substate
			target.assigned_to = current.variable_pool.req_assignment_ref; //Assign to user
			target.update();
			current.short_description = "Checked out to user";
		}
	} else if (current.variable_pool.req_action == 'Preparing for User'){
		target.install_status = '3'; //State = In Maintenance
		target.substatus = 'preparing_for_user'; //Substate = Preparing for user
		target.u_assigned_tech = current.variable_pool.req_tech_ref; //Assign to Tech
		target.assigned_to = current.variable_pool.req_assignment_ref; //Reserve for User
		target.update();
		current.short_description = "Checked out to prepare for user";
	} else if (current.variable_pool.req_action == 'Ready for Pickup'){
		target.install_status = '6'; //State = In Stock
		target.substatus = 'reserved'; //Substate = Reserved
		target.reserved_for = current.variable_pool.req_assignment_ref; //Reserve for User
		target.stockroom = current.variable_pool.req_stockroom; //Stockroom matches submission
		target.update();
		current.short_description = "Checked in, Ready for User Pickup";
	} else if (current.variable_pool.req_action == 'Shipping to User'){
		target.install_status = '1'; //State = In use
		target.substatus = ''; //No Substate
		target.assigned_to = current.variable_pool.req_assignment_ref; //Assign to user
		target.update();
		current.short_description = "Shipped to User. Shipping details inside";
	}
}