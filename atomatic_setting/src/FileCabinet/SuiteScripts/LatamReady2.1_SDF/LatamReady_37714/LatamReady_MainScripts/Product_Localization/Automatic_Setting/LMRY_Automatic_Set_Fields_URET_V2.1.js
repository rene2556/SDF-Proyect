/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @Name LMRY_Automatic_Set_Fields_URET_V2.1.js
 * @Author rene@latamready.com
 * @NModuleScope public
 */
define(['N/error', 'N/log', 'N/runtime', 'N/search', 'N/ui/serverWidget', './SuiteBundles/Bundle 35754/Latam_Library/LMRY_libSendingEmailsLBRY_V2.0'],
    /**
     * @param{error} error
     * @param{log} log
     * @param{runtime} runtime
     * @param{search} search
     * @param{serverWidget} serverWidget
     */
    (error, log, runtime, search, serverWidget, Library_Mail) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        let recordObj = '';
        let context_type = '';
        let licenses = [];
        let FEAT_SUBSIDIARY = false;
        let FEAT_MULTISUBCUSTOMER = false;

        const countryDocuments = [11, 29, 30, 91, 157, 173, 174, 186, 231];
        const transactionFieldById = {
            5: 'custrecord_lmry_setup_us_cashsale',
            7: 'custrecord_lmry_setup_us_invoice',
            9: 'custrecord_lmry_setup_us_payment',
            10: 'custrecord_lmry_setup_us_credit',
            16: 'custrecord_lmry_setup_us_recepit',
            17: 'custrecord_lmry_setup_us_vendorbill',
            20: 'custrecord_lmry_setup_us_vendorcredit',
            32: 'custrecord_lmry_setup_us_fulfillment',
            39: 'custrecord_lmry_setup_us_paymntcomplemnt'
        }
        const beforeLoad = (scriptContext) => {
            try {
                const actionType = scriptContext.type;
                let form = scriptContext.form;
                let recordObj = scriptContext.newRecord;

                if (runtime.excutionContext !== "CSVIMPORT" && ["create", "edit", "copy", "view"].includes(actionType)) {
                    form.removeButton("resetter");
                    FEAT_SUBSIDIARY = runtime.isFeatureInEffect({
                        feature: 'SUBSIDIARIES'
                    });

                    //Se oculta el campo del setup tax siempre
                    form.getField('custrecord_lmry_us_setuptax').updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });

                    //Si viene de subsidiaria, ocultar campos de entidad (Entidad y el Entity Type)
                    let setupTaxsubsid = recordObj.getValue('custrecord_lmry_us_setuptax');

                    if (setupTaxsubsid) {
                        form.getField('custrecord_lmry_us_entity').updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.HIDDEN
                        });
                        form.getField('custrecord_lmry_us_entity_type').updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.HIDDEN
                        });
                    }


                    if (actionType == "create" || actionType == "edit" || actionType == "copy") {
                        let entity = recordObj.getValue("custrecord_lmry_us_entity");
                        let setupTax = recordObj.getValue("custrecord_lmry_us_setuptax");

                        if (entity) {
                            if (actionType === "create") {
                                if (FEAT_SUBSIDIARY === "T" || FEAT_SUBSIDIARY) {
                                    //crear campo custpage de subsidiaria
                                    let select_subsidiary = form.addField({
                                        id: 'custpage_subsidiary',
                                        type: serverWidget.FieldType.SELECT,
                                        label: 'LATAM - SUBSIDIARY (SET)'
                                    });

                                    //Ocultar el campo de la subsidiaria real
                                    form.getField('custrecord_lmry_us_subsidiary').updateDisplayType({
                                        displayType: serverWidget.FieldDisplayType.HIDDEN
                                    });

                                    form.insertField({
                                        field: select_subsidiary,
                                        nextfield: 'custrecord_lmry_us_country'
                                    });

                                    //Llenar con las subsidiarias de la entidad(customer, vendor)
                                    fillSubsidiaries(select_subsidiary, recordObj);

                                    let subsidiary = recordObj.getValue("custrecord_lmry_us_subsidiary");
                                    select_subsidiary.defaultValue = subsidiary;
                                }


                                //Crear campo custpage de transacciones
                                let select_transaction = form.addField({
                                    id: 'custpage_transaction',
                                    type: serverWidget.FieldType.SELECT,
                                    label: 'LATAM - TRANSACTION (SET)'
                                });

                                form.insertField({
                                    field: select_transaction,
                                    nextfield: 'custrecord_lmry_us_transaction'
                                });
                                let country = recordObj.getValu({fieldId: "custrecord_lmry_us_country"});
                                fillTransactions(select_transaction, recordObj, country);

                                //ocultar el campo real de las transacciones
                                form.getField('custrecord_lmry_us_transaction').updateDisplayType({
                                    displayType: serverWidget.FieldDisplayType.HIDDEN
                                });

                            }
                        } else if (setupTax) {
                            if (actionType === "create") {
                                //Setear el campo subsidiary con al subsidiaria del setup tax subsidiary de donde viene
                                let setupTax = recordObj.getValue("custrecord_lmry_us_setuptax");

                                let searchSetupTax = search.lookupFields({
                                    type: 'customrecord_lmry_setup_tax_subsidiary',
                                    id: setupTax,
                                    columns: ['custrecord_lmry_setuptax_subsidiary', 'custrecord_lmry_setuptax_sub_country']
                                });
                                //Subsidiaria Setup Tax
                                let stSubsidiaria = searchSetupTax.custrecord_lmry_setuptax_subsidiary[0].value;

                                //Country Setup Tax
                                let stCountry = searchSetupTax.custrecord_lmry_setuptax_sub_country[0].value;

                                recordObj.setValue('custrecord_lmry_us_subsidiary', stSubsidiaria);

                                recordObj.getField('custrecord_lmry_us_subsidiary').updateDisplayType({
                                    displayType: serverWidget.FieldDisplayType.DISABLED
                                });

                                //crear el campo custpage para transacciones y llenar con todas las transacciones de ese pais
                                let transactionField = form.addField({
                                    id: 'custpage_transaction',
                                    type: serverWidget.FieldType.SELECT,
                                    label: 'LATAM - TRANSACTION (SET)'
                                });
                                form.insertField({
                                    field: transactionField,
                                    nextfield: 'custrecord_lmry_us_transaction'
                                });

                                fillTransactions(transactionField, recordObj, stCountry);

                                //ocultar el campo real de transaccion.
                                recordObj.getField('custrecord_lmry_us_transaction').updateDisplayType({
                                    displayType: serverWidget.FieldDisplayType.HIDDEN
                                });
                            }

                        } else {
                            //Deshabilitar campos de la subsidiaria,transacciones
                            recordObj.getField('custrecord_lmry_us_subsidiary').updateDisplayType({
                                displayType: serverWidget.FieldDisplayType.DISABLED
                            });
                            recordObj.getField('custrecord_lmry_us_transaction').updateDisplayType({
                                displayType: serverWidget.FieldDisplayType.DISABLED
                            });

                        }

                        if (actionType == "edit" || actionType === "copy") {

                            if (entity) {
                                form.getField('custrecord_lmry_us_entity').updateDisplayType({
                                    displayType: serverWidget.FieldDisplayType.DISABLED
                                });
                            }
                            //Deshabilitar el campo subsidiary
                            form.getField('custrecord_lmry_us_subsidiary').updateDisplayType({
                                displayType: serverWidget.FieldDisplayType.DISABLED
                            });

                            //Deshabilitar el campo transaccion
                            form.getField('custrecord_lmry_us_transaction').updateDisplayType({
                                displayType: serverWidget.FieldDisplayType.DISABLED
                            });

                        }
                        //Oculta campos con country vacio y mostrar campos del pais y transaccion.
                        hideAndViewFields(recordObj, form);
                    } else if (actionType === "view") {
                        hideAndViewFields(recordObj, form);
                    }
                }


            } catch (err) {
                log.error("[beforeLoad]", err);
            }

        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            //Record Actual
            recordObj = scriptContext.newRecord;
            // LatamReady - Automatic Set MX C0665
            checkFeatureAutomaticSetGen(recordObj, licenses);
            try {
                //ID de la Subsidiary
                let subsidiaryID = recordObj.getValue('custrecord_lmry_us_subsidiary');
                //ID de la Transacción
                let transactionID = recordObj.getValue('custrecord_lmry_us_transaction');
                //ID del país
                let countryID = recordObj.getValue('custrecord_lmry_us_country');
                //Obtener licencias
                licenses = Library_Mail.getLicenses(subsidiaryID);
                let arrayLegalDocumentCountry = ["11", "29", "30", "91", "157", "173", "174", "186", "231"];

                if (context_type == 'CSVIMPORT') {

                }


            } catch (err) {
                log.error('error BS', err);

            }
        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {

        }

        //Oculta campos con country vacio y mostrar campos del pais y transaccion.
        const hideAndViewFields = (recordObj, form) => {
            let filterView = [];

            let country = recordObj.getValue('custrecord_lmry_us_country') || "";
            country = Number(country);
            let transaction = recordObj.getValue('custrecord_lmry_us_transaction') || "";
            transaction = Number(transaction);
            if (country && transaction) {
                filterView.push(["custrecord_lmry_setup_us_country", "anyof", country]);
                let isNotaDebito = false, isExportacion = false, isLibreConsigna = false;
                //Invoice, CreditMemo
                let document = recordObj.getValue('custrecord_lmry_document_type');

                if ([7, 10].includes(transaction) && countryDocuments.includes(country) && document) {
                    let recordDocument = search.lookupFields({
                        type: 'customrecord_lmry_tipo_doc',
                        id: document,
                        columns: ['custrecord_lmry_es_nota_de_debito', 'custrecord_lmry_es_exportacion', 'custrecord_lmry_es_libre_consigna']
                    });
                    isNotaDebito = recordDocument.custrecord_lmry_es_nota_de_debito;
                    isExportacion = recordDocument.custrecord_lmry_es_exportacion;
                    isLibreConsigna = recordDocument.custrecord_lmry_es_libre_consigna;
                }

                if (transaction == 7) {
                    if (isExportacion && isNotaDebito) {
                        filterView.push("AND", ["custrecord_lmry_setup_us_notadeb_exp", "is", "T"]);
                    } else if (isNotaDebito) {
                        filterView.push("AND", ["custrecord_lmry_setup_us_nota_deb", "is", "T"]);
                    } else if (isExportacion) {
                        filterView.push("AND", ["custrecord_lmry_setup_us_inv_exp", "is", "T"]);
                    } else if (isLibreConsigna) {
                        filterView.push("AND", ["custrecord_lmry_setup_us_lib_consig", "is", "T"]);
                    } else if (!isExportacion && !isNotaDebito && !isLibreConsigna) {
                        filterView.push("AND", ["custrecord_lmry_setup_us_invoice", "is", "T"])
                    }
                } else if (transaction == 10 && isExportacion) {
                    filterView.push("AND", ["custrecord_lmry_setup_us_credit_exp", "is", "T"]);
                } else {
                    filterView.push("AND", [transactionFieldById[transaction], "is", "T"]);
                }
            }

            let filters = [
                ["isinactive", "is", "F"]
            ];

            if (filterView.length) {
                filters.push("AND", [
                    ["custrecord_lmry_setup_us_country", "anyof", "@NONE@"], "OR",
                    filterView
                ]);
            } else {
                filters.push("AND", ["custrecord_lmry_setup_us_country", "anyof", "@NONE@"]);
            }

            let viewSearch = search.create({
                type: "customrecord_lmry_setup_universal_set_v2",
                filters: filters,
                columns: ["name", "custrecord_lmry_setup_us_country"]
            });

            let results = viewSearch.run().getRange(0, 1000);
            let hideFields = [], viewFields = [];

            for (let i = 0; i < results.length; i++) {
                let name = results[i].getValue("name") || "";
                name = name.trim();
                let country = results[i].getValue("custrecord_lmry_setup_us_country") || "";
                if (country) {
                    viewFields.push(name);
                } else {
                    hideFields.push(name);
                }
            }

            hideFields.forEach((fieldName) => {
                if (!viewFields.includes(fieldName)) {
                    let fieldObj = form.getField(fieldName);
                    if (fieldObj) {
                        fieldObj.updateDisplayType({
                            displayType: serverWidget.FieldDisplayType.HIDDEN
                        })
                    }
                }
            });

        }

        const fillSubsidiaries = (subsidiaryField, recordObj) => {
            subsidiaryField.addSelectOption({
                value: "",
                text: "&nbsp"
            });

            let entity = recordObj.getValue({fieldId: "custrecord_lmry_us_entity"});
            let entityType = recordObj.getValue({fieldId: "custrecord_lmry_us_entity_type"});

            //Customer
            if (entityType == 2 && (FEAT_MULTISUBCUSTOMER === "F" || FEAT_MULTISUBCUSTOMER)) {
                let entityResult = search.lookupFields({
                    type: "entity",
                    id: entity,
                    columns: ["subsidiary"]
                });

                subsidiaryField.addSelectOption({
                    value: entityResult.subsidiary[0].value,
                    text: entityResult.subsidiary[0].text
                });

            } else {
                let searchType = "vendorsubsidiaryrelationship";
                if (entityType == 2) {
                    searchType = "customersubsidiaryrelationship";
                }

                let subsidiarySearch = search.create({
                    type: searchType,
                    filters: [
                        //["isinactive", "is", "F"], "AND",
                        ["entity", "anyof", entity]
                    ],
                    columns: ["subsidiary"]
                });

                let results = subsidiarySearch.run().getRange(0, 1000);
                for (let i = 0; i < results.length; i++) {
                    let id = results[i].getValue("subsidiary");
                    let name = results[i].getText("subsidiary");

                    subsidiaryField.addSelectOption({value: id, text: name});
                }
            }

        }

        const fillTransactions = (transactionField, recordObj, country) => {
            transactionField.addSelectOption({
                value: "",
                text: "&nbsp"
            })
            //Tipo de entidad (1: vendor, 2: customer)
            let entityTypeID = recordObj.getValue('custrecord_lmry_us_entity_type');
            //Objeto de transacciones por país y tipo de entidad
            const jsonTransactionByCountry = {
                "11": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                },
                "29": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                },
                "30": {
                    "1": ["vendorbill", "vendorcredit", "itemreceipt"],
                    "2": ["invoice", "creditmemo", "itemfulfillment"]
                },
                "45": {
                    "1": [],
                    "2": ["invoice", "creditmemo"] //7, 10
                },
                "48": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                },
                "49": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                },
                "63": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                },
                "91": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                },
                "157": {
                    "1": [],
                    "2": ["invoice", "creditmemo", "itemfulfillment", "customerpayment", "customtransaction_lmry_payment_complemnt"]
                },
                "173": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                },
                "174": {
                    "1": [],
                    "2": ["invoice", "creditmemo", "itemfulfillment", "cashsale"]
                },
                "186": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                },
                "231": {
                    "1": [],
                    "2": ["invoice", "creditmemo"]
                }
            };

            const transactionsById = {
                "invoice": {name: "Invoice", id: 7},
                "creditmemo": {name: "Credit Memo", id: 10},
                "vendorbill": {name: "Bill", id: 17},
                "vendorcredit": {name: "Bill Credit", id: 20},
                "itemfulfillment": {name: "Item Fulfillment", id: 32},
                "customerpayment": {name: "Payment", id: 9},
                "customtransaction_lmry_payment_complemnt": {name: "Complemento de Pago", id: 39},
                "cashsale": {name: "Cash Sale", id: 5},
                "itemreceipt": {name: "Item Receipt", id: 16}
            };

            //Arreglo de transacciones del tipo de entidad actual
            let transactions = [];

            if (entityTypeID && (entityTypeID == "1" || entityTypeID == "2") && country) {
                transactions = jsonTransactionByCountry[country][entityTypeID]
            } else {
                transactions = [...jsonTransactionByCountry[country]["1"], ...jsonTransactionByCountry[country]["2"]];
            }

            for(let i = 0; i<transactions.length ; i++){
                let { name, id } = transactionsById[transactions[i]];
                transactionField.addSelectOption({ value : id, text : name });
            }
        }

        //AUTOMATIC FIELDS BY SUBSIDIARY (A/R) -MX
        const checkFeatureAutomaticSetGen = (recordObj, licenses) => {
            if (context_type == 'CSVIMPORT') {
                let setupTaxSubsid = recordObj.getValue('custrecord_lmry_us_setuptax');
                let country = recordObj.getValue('custrecord_lmry_us_country');

                if (setupTaxSubsid) {
                    if (country != 157 || !Library_Mail.getAuthorization(975, licenses)) {
                        throw error.create({
                            name: 'ERROR_AUTHOMATIC_SET_SUBSIDIARY',
                            message: 'Disabled feature',
                            notifyOff: true
                        })
                    }
                }
            }

        }
        return {
            beforeLoad: beforeLoad,
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        }

    });
