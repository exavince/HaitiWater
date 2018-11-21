# Generated by Django 2.1.2 on 2018-11-21 14:23

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('water_network', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Consumer',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('first_name', models.CharField(max_length=20, verbose_name='Prénom')),
                ('last_name', models.CharField(max_length=20, verbose_name='Nom')),
                ('gender', models.CharField(choices=[('M', 'Homme'), ('F', 'Femme'), ('O', 'Autre')], max_length=1, null=True, verbose_name='Genre')),
                ('phoneNumber', models.CharField(max_length=10, null=True, verbose_name='Numéro de téléphone')),
                ('email', models.CharField(max_length=50, null=True, verbose_name='Adresse email')),
                ('household_size', models.IntegerField(verbose_name='Taille du ménage')),
                ('location', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='people', to='water_network.Location', verbose_name='Localité')),
                ('water_outlet', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='consumers', to='water_network.Element', verbose_name="Sortie d'eau")),
            ],
            options={
                'abstract': False,
            },
        ),
    ]
