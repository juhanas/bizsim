from django.shortcuts import render, redirect
from django.core.urlresolvers import reverse
from django.http import HttpResponse, HttpResponseRedirect
from django.conf import settings
import requests, boto3, json
import sys
from .forms import *

url = getattr(settings, "URL", None)
auth = getattr(settings, "AUTH", None)

def index(request, message = ''):
    '''
    The front page of the application.
    Shows forms to login or create an account or a company.
    '''
    if request.method == 'POST':
        if 'login' in request.POST:
            return handleLogin(request)
        elif 'register' in request.POST:
            return handleNewUser(request)
        elif 'newcompany' in request.POST:
            return handleNewCompany(request)
    form1 = loginForm()
    form2 = newUserForm()
    return render(request, 'index.html', { 'loginForm' : form1, 'newUserForm' : form2, 'loginMessage': message, 'newUserMessage' : message})

def handleLogin(request):
    '''
    Logs the user in and redirects the user to the game front page.
    '''    
    if request.method == 'POST':
        form = loginForm(request.POST)
        if form.is_valid():
            data = { \
                'email' : form.cleaned_data['email'],
                'password' : form.cleaned_data['password']
            }
            response2 = requests.post(url + '/auth/login/', auth=auth, json=data).json()
            
            # Check if response2 contains an error or success.
            if not 'login' in response2 or not response2['login']:
                if 'error' in response2 and response2['error']:
                    return render(request, 'index.html', { 'loginForm' : form, 'loginMessage' : 'Error: ' + response2['error']})
                elif 'message' in response2 and response2['message']:
                    return render(request, 'index.html', { 'loginForm' : form, 'loginMessage' : 'Error: ' + response2['message']})
                return render(request, 'index.html', { 'loginForm' : form, 'loginMessage' : 'Error! Something went wrong: ' + str(response2)})
                
            if 'companies' in response2 and response2['companies']:
                return game(request, 1, response2['companies']['1'], response2['token'])
            else:
                request.POST = {'createCompany': True}
                return createNewCompany(request, response2['token'], ('You are now logged in as ' +response2['username']))
            
        else:
            return render(request, 'index.html', {'loginForm' : form, 'loginMessage' : 'Please check the submitted data.'})
    return index(request)
    
def handleNewUser(request):
    '''
    Creates a new user and redirects the user back to the front page.
    '''    
    if request.method == 'POST':
        form = newUserForm(request.POST)
        if form.is_valid():
            data = { \
                'username' : form.cleaned_data['username'],
                'email' : form.cleaned_data['email'],
                'password' : form.cleaned_data['password1'],
            }
            
            response2 = requests.post(url + '/users/', auth=auth, json=data).json()
            print(response2)
            # Check if response2 contains an error or success. 
            if not 'created' in response2 or not response2['created']:
                if 'error' in response2 and response2['error']:
                    return render(request, 'index.html', { 'newUserForm' : form, 'newUserMessage' : 'Error: ' + response2['error']})
                elif 'message' in response2 and response2['message']:
                    return render(request, 'index.html', { 'newUserForm' : form, 'newUserMessage' : 'Error: ' + response2['message']})
                return render(request, 'index.html', { 'newUserForm' : form, 'newUserMessage' : 'Error! Something went wrong: ' + str(response2)})

            request.POST = {'createCompany': True}
            return createNewCompany(request, response2['token'], ('You are now logged in as ' +response2['username']))
        else:
            return render(request, 'index.html', {'newUserForm' : form, 'newUserMessage' : 'Please check the submitted data.'})
    return index(request)
    
def createNewCompany(request, token, message=''):
    '''
    Shows the form for creating a new company.
    '''
    print("Creating a new company")
    createCompanyForm = CreateCompanyForm(initial= {
        # TODO: Correct id values
        'areaId' : 1,
        'gameId' : 1,
        'industryId' : 1,
        'gameName' : 'Game1'
    })
    return render(request, 'index.html', {'createCompanyForm' : createCompanyForm, 'createCompanyMessage' : message, 'token': token})

def handleNewCompany(request):
    '''
    Creates a new company and opens the game front page.
    '''
    if request.method == 'POST':
        form = CreateCompanyForm(request.POST)
        if form.is_valid():
            data = { \
                'token' : request.POST['token'],
                'gameName' : form.cleaned_data['gameName'],
                'gameId' : form.cleaned_data['gameId'],
                'areaId' : form.cleaned_data['areaId'],
                'industryId' : form.cleaned_data['industryId'],
                'companyName' : form.cleaned_data['companyName']
            }
            
            #Save the new company in the database
            response2 = requests.post(url + '/companies/', auth=auth, json=data).json()
            print(response2)
            
            # Check if response2 contains an error or success. 
            if not 'created' in response2 or not response2['created']:
                if 'error' in response2 and response2['error']:
                    return render(request, 'index.html', { 'createCompanyForm' : form, 'createCompanyMessage' : 'Error: ' + response2['error']})
                elif 'message' in response2 and response2['message']:
                    return render(request, 'index.html', { 'createCompanyForm' : form, 'createCompanyMessage' : 'Error: ' + response2['message']})
                return render(request, 'index.html', { 'createCompanyForm' : form, 'createCompanyMessage' : 'Error! Something went wrong: ' + str(response2)})
            return game(request, 1, response2['company']['ID'], request.POST['token'])
        else:
            return render(request, 'index.html', {'createCompanyForm' : form, 'createCompanyMessage' : 'Please check the submitted data.'})

    return index(request)
    
def game(request, gameId, companyId, token, message=''):
    '''
    Renders the game page of the application.
    '''
    industryId = 1
    propertyId = 1
    header = {'token': token}

    company = requests.get(url + '/companies', params={'game': gameId, 'company': companyId}, headers=header, auth=auth).json()
    if ('error' in company and company['error']) or ('message' in company and company['message']) or ('errorMessage' in company and company['errorMessage']):
        return index(request, 'Error: ' + str(company))
    company = company['Item']

    property = requests.get(url + '/properties', auth=auth, params={'game': 1, 'property': company['Properties'][0]}, headers=header).json()
    if ('error' in property and property['error']) or ('message' in property and property['message']) or ('errorMessage' in property and property['errorMessage']):
        return index(request, 'Error: ' + str(property))
    property = property['Item']

    '''
    industry = requests.get(url + '/industries', auth=auth, params={'game': 1}, headers=header).json()['Item']
    if ('error' in industry and industry['error']) or ('message' in industry and industry['message']) or ('errorMessage' in industry and industry['errorMessage']):
        return index(request, 'Error: ' + str(industry))
    industry = industry['Item']
    '''
    gameInfo = {'Name' : 'Game1', 'Id' : 1}    
    
    company['Money'] = "{:,}".format(company['Money'])
    orderForm = AssignOrdersForm(initial={ \
        'productionOrder' : property['Production'],
        'capacityChangeOrder' : 0,
        'storageChangeOrder' : 0,
        'priceOrder' : property['Price']
    })
    orderForm.fields['productionOrder'].widget.attrs['min'] = 0
    orderForm.fields['productionOrder'].widget.attrs['max'] = property['CapacityProduction']
    orderForm.fields['capacityChangeOrder'].widget.attrs['step'] = property['StepCapacityChange']
    orderForm.fields['capacityChangeOrder'].widget.attrs['min'] = ( 0 - property['CapacityProduction'] )
    orderForm.fields['capacityChangeOrder'].widget.attrs['max'] = ( property['CapacityMax'] - property['CapacityProduction'] )
    orderForm.fields['storageChangeOrder'].widget.attrs['step'] = property['StepStorageChange']
    orderForm.fields['storageChangeOrder'].widget.attrs['min'] = ( 0 - property['WarehouseSize'] )
    orderForm.fields['storageChangeOrder'].widget.attrs['max'] = ( property['WarehouseSizeMax'] - property['WarehouseSize'] )
    orderForm.fields['priceOrder'].widget.attrs['min'] = 0
    return render(request, 'game.html', {'company': company,'industry': {'Name': 'Industry1', 'Demand': 1000}, 'property': property, 'message': '', 'orderForm' : orderForm, 'game' : gameInfo, 'token': token})
    
def processround(request):
    '''
    Sends the command to process a round and redirects back to front page.
    '''
    response2 = requests.get(url + '/processround', auth=auth)
    return index(request, response2.json())
    #return HttpResponseRedirect(reverse('index', kwargs={'message': response2}))
    #return HttpResponse(response)
    
def setOrders(request):
    if request.method == 'POST':
        orders = json.loads(request.body.decode('utf-8'))#handleAssignOrderForm(request)
        print("Orders: " + str(orders))
        message = 'Error!'
        
        if (len(orders) > 0):
            response = requests.post(url + '/orders', auth=auth, json=orders)#, headers={'X-Reimbursement-User': request.user.username})

        return HttpResponse(response)
    
def handleAssignOrderForm(request):
    '''
    Handles the AssignOrderForm and returns the form data in JSON format.
    '''
    form = AssignOrdersForm(request.POST)
    json = {}
    if form.is_valid():
        productionCapacity = form.cleaned_data['CapacityProduction']
        productionIncrease = form.cleaned_data['productionIncrease']
        productionDecrease = form.cleaned_data['productionDecrease']
        storageIncrease = form.cleaned_data['storageIncrease']
        storageDecrease = form.cleaned_data['storageDecrease']
        price = form.cleaned_data['price']

        json = \
            {
                'CapacityProduction': productionCapacity,
                'productionIncrease': productionIncrease,
                'productionDecrease': productionDecrease,
                'storageIncrease': storageIncrease,
                'storageDecrease': storageDecrease,
                'price' : price
            }
    return json
'''
def login(request):
    
    Handles logging in a user
    
    form = loginForm(request.POST)
    if form.is_valid():
        userName = form.cleaned_data['username']
        password = form.cleaned_data['password']
        return HttpResponseRedirect(reverse('game', kwargs={'username': username, 'authToken' : password}))
'''