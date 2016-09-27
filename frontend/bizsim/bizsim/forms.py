from django import forms

class AssignOrdersForm(forms.Form):
    productionOrder = forms.IntegerField(label="Production volume", required=False)
    capacityChangeOrder = forms.IntegerField(label="Change capacity by", required=False)
    storageChangeOrder = forms.IntegerField(label="Change storage by", required=False)
    priceOrder = forms.IntegerField(label="Price of one product, $", required=False)

class CreateCompanyForm(forms.Form):
    companyName = forms.CharField(label="Name of your company", required=True)
    areaId = forms.IntegerField(label="Area Id", required=True)
    industryId = forms.IntegerField(label="Industry Id", required=True)
    gameName = forms.CharField(label="Name of the game", required=True)
    gameId = forms.IntegerField(label="Id of the game", required=True)

class loginForm(forms.Form):
    email = forms.EmailField(label="Email", required=True)
    password = forms.CharField(label="Password", required=True, widget=forms.PasswordInput())

class newUserForm(forms.Form):
    username = forms.CharField(label="Name of the CEO", required=True)
    email = forms.EmailField(label="Your email, used for logging in", required=True)
    password1 = forms.CharField(label="Password", required=True, widget=forms.PasswordInput())
    password2 = forms.CharField(label="Confirm password", required=True, widget=forms.PasswordInput())
    
    def clean(self):
        password1 = self.cleaned_data.get('password1')
        password2 = self.cleaned_data.get('password2')

        if password1 and password1 != password2:
            raise forms.ValidationError("Passwords don't match")

        return self.cleaned_data

